import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Form, KeyboundForm, SectionRow } from "@medusajs/dashboard/components"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, Button, Drawer, Input, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Container } from "../components/common/container"
import { Header } from "../components/common/header"
import { NumberInput } from "../components/common/number-input"
import { sdk } from "../lib/client"
import {
  FLASH_SALE_PARSE_OPTIONS,
  flashSaleFormSchema,
  optionalPositiveInt,
  toFlashSaleFormValues,
} from "../lib/flash-sale-form"
import { createSingleFlight } from "../lib/single-flight"

// FS-5 (spec 03): "Flash sale options" บนหน้า Campaign detail
// บันทึกแล้ว backend ใส่ exclusivity rule ให้ automatic promotion ของ campaign (กฎข้อ 7) และเตือนตัวที่ยังไม่มี rule

type FlashSaleConfig = {
  id: string
  campaign_id: string
  per_customer_limit: number | null
  total_cap: number | null
  units_sold: number
  show_countdown: boolean
  show_remaining: boolean
  banner_text: string | null
}

type FlashSaleConfigResponse = {
  flash_sale_config: FlashSaleConfig | null
  promotions_missing_exclusivity: { id: string; code: string | null }[]
}

const FlashSaleOptionsWidget = ({ data: campaign }: DetailWidgetProps<HttpTypes.AdminCampaign>) => {
  const queryClient = useQueryClient()
  const queryKey = ["flash-sale-config", campaign.id]
  const [open, setOpen] = useState(false)
  // ADM-3 (spec 08 กฎ 8): Form + KeyboundForm ของ dashboard + zod — ⌘/Ctrl+Enter ส่งได้
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้วแปลงเป็น body ด้วย schema เดียวกันตอน submit
  const form = useForm({
    resolver: zodResolver(flashSaleFormSchema, FLASH_SALE_PARSE_OPTIONS, { raw: true }),
    defaultValues: toFlashSaleFormValues(null),
  })
  // FS-10 (กฎข้อ 15 / spec 08 กฎ 4): คลิกซ้ำใน tick เดียวยังเห็น isPending เดิม จึงกันด้วย guard ที่ตั้งแบบ synchronous ก่อน mutate
  const [saveOnce] = useState(createSingleFlight)

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.client.fetch<FlashSaleConfigResponse>(`/admin/flash-sales/${campaign.id}/config`),
  })
  const config = data?.flash_sale_config ?? null
  const missing = data?.promotions_missing_exclusivity ?? []

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<FlashSaleConfigResponse>(`/admin/flash-sales/${campaign.id}/config`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success("Flash sale options saved")
      setOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save flash sale options")
    },
  })

  const unitsSold = config?.units_sold ?? 0
  const totalCap = optionalPositiveInt.safeParse(form.watch("total_cap")).data
  const capBelowSold = typeof totalCap === "number" && totalCap <= unitsSold

  const openEditor = () => {
    form.reset(toFlashSaleFormValues(config))
    setOpen(true)
  }

  // dblclick Save / ⌘+Enter ซ้ำ ผ่าน validation พร้อมกันได้ — createSingleFlight ให้ POST ครั้งเดียว
  const handleSave = form.handleSubmit((values) =>
    saveOnce(() =>
      save.mutateAsync(flashSaleFormSchema.parse(values, FLASH_SALE_PARSE_OPTIONS)).catch(() => undefined)
    )
  )

  return (
    <Container data-testid="flash-sale-options">
      <Header
        title="Flash sale options"
        actions={[
          {
            type: "button",
            props: { variant: "secondary", onClick: openEditor, disabled: isLoading, children: "Edit" },
          },
        ]}
      />

      {missing.length > 0 && (
        <div className="px-6 py-4">
          <Alert variant="warning">
            Automatic promotions without the exclusivity rule can stack with promotion codes:{" "}
            {missing.map((p) => p.code ?? p.id).join(", ")}. Save the flash sale options to add
            the rule.
          </Alert>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Loading...
          </Text>
        </div>
      ) : !config ? (
        <div className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            This campaign is not a flash sale yet. Save the options to enable per-customer limits,
            total cap and storefront countdown.
          </Text>
        </div>
      ) : (
        // SectionRow ไม่รับ data-testid จึงห่อแต่ละแถวด้วย div ที่มี testid (e2e ของ AC-5 อ่านค่า Total cap)
        [
          ["per_customer_limit", "Per-customer limit", config.per_customer_limit?.toString() ?? "Unlimited"],
          ["total_cap", "Total cap", config.total_cap?.toString() ?? "Unlimited"],
          ["units_sold", "Units sold", config.units_sold.toString()],
          ["show_countdown", "Show countdown", config.show_countdown ? "Yes" : "No"],
          ["show_remaining", "Show remaining", config.show_remaining ? "Yes" : "No"],
          ["banner_text", "Banner text", config.banner_text ?? "-"],
        ].map(([key, title, value]) => (
          <div key={key} data-testid={`flash-sale-row-${key}`}>
            <SectionRow title={title} value={value} />
          </div>
        ))
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          {/* noValidate: validation ทั้งหมดเป็นของ zod (error ใต้ช่อง) ไม่ให้ browser ดัก min ของ input number ก่อน */}
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
              <Drawer.Header>
                <Drawer.Title>Flash sale options</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex-1 overflow-auto p-4">
                <div className="flex flex-col gap-y-4">
                  <Form.Field
                    control={form.control}
                    name="per_customer_limit"
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>Per-customer limit</Form.Label>
                        <Form.Control>
                          <NumberInput {...field} min={1} placeholder="Unlimited" />
                        </Form.Control>
                        <Form.ErrorMessage data-testid="fs-per-customer-limit-error" />
                      </Form.Item>
                    )}
                  />
                  <Form.Field
                    control={form.control}
                    name="total_cap"
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>Total cap</Form.Label>
                        <Form.Control>
                          <NumberInput {...field} min={1} placeholder="Unlimited" />
                        </Form.Control>
                        <Form.ErrorMessage data-testid="fs-total-cap-error" />
                        {capBelowSold && (
                          <Form.Hint>
                            {unitsSold} units already sold — new checkouts will fail as sold out.
                          </Form.Hint>
                        )}
                      </Form.Item>
                    )}
                  />
                  {(
                    [
                      ["show_countdown", "Show countdown"],
                      ["show_remaining", "Show remaining"],
                    ] as const
                  ).map(([name, label]) => (
                    <Form.Field
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field: { value, onChange, ...field } }) => (
                        <Form.Item className="flex-row items-center justify-between space-y-0">
                          <Form.Label>{label}</Form.Label>
                          <Form.Control>
                            <Switch {...field} checked={value} onCheckedChange={onChange} />
                          </Form.Control>
                        </Form.Item>
                      )}
                    />
                  ))}
                  <Form.Field
                    control={form.control}
                    name="banner_text"
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>Banner text</Form.Label>
                        <Form.Control>
                          <Input {...field} />
                        </Form.Control>
                      </Form.Item>
                    )}
                  />
                </div>
              </Drawer.Body>
              <Drawer.Footer>
                <div className="flex items-center justify-end gap-x-2">
                  <Drawer.Close asChild>
                    <Button size="small" variant="secondary" type="button" disabled={save.isPending}>
                      Cancel
                    </Button>
                  </Drawer.Close>
                  <Button size="small" type="submit" disabled={save.isPending} isLoading={save.isPending}>
                    Save
                  </Button>
                </div>
              </Drawer.Footer>
            </KeyboundForm>
          </Form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "campaign.details",
})

export default FlashSaleOptionsWidget
