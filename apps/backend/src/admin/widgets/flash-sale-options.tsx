import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { SectionRow } from "@medusajs/dashboard/components"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import {
  Alert,
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Container } from "../components/common/container"
import { Header } from "../components/common/header"
import { sdk } from "../lib/client"
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

type FormState = {
  per_customer_limit: string
  total_cap: string
  show_countdown: boolean
  show_remaining: boolean
  banner_text: string
}

const toForm = (config: FlashSaleConfig | null): FormState => ({
  per_customer_limit: config?.per_customer_limit?.toString() ?? "",
  total_cap: config?.total_cap?.toString() ?? "",
  show_countdown: config?.show_countdown ?? false,
  show_remaining: config?.show_remaining ?? false,
  banner_text: config?.banner_text ?? "",
})

// ว่าง = ไม่จำกัด (null); ไม่ใช่จำนวนเต็มบวก = undefined (invalid)
const parseLimit = (value: string): number | null | undefined => {
  if (value.trim() === "") {
    return null
  }
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const FlashSaleOptionsWidget = ({ data: campaign }: DetailWidgetProps<HttpTypes.AdminCampaign>) => {
  const queryClient = useQueryClient()
  const queryKey = ["flash-sale-config", campaign.id]
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(toForm(null))
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

  const perCustomerLimit = parseLimit(form.per_customer_limit)
  const totalCap = parseLimit(form.total_cap)
  const invalid = perCustomerLimit === undefined || totalCap === undefined
  const unitsSold = config?.units_sold ?? 0
  const capBelowSold = typeof totalCap === "number" && totalCap <= unitsSold

  const openEditor = () => {
    setForm(toForm(config))
    setOpen(true)
  }

  const handleSave = () => {
    if (invalid) {
      return
    }
    const body = {
      per_customer_limit: perCustomerLimit,
      total_cap: totalCap,
      show_countdown: form.show_countdown,
      show_remaining: form.show_remaining,
      banner_text: form.banner_text.trim() === "" ? null : form.banner_text,
    }
    saveOnce(() => save.mutateAsync(body).catch(() => undefined))
  }

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
          <Drawer.Header>
            <Drawer.Title>Flash sale options</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex-1 overflow-auto p-4">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="fs-per-customer-limit">Per-customer limit</Label>
                <Input
                  id="fs-per-customer-limit"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.per_customer_limit}
                  onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })}
                />
                {perCustomerLimit === undefined && (
                  <Text size="small" className="text-ui-fg-error">
                    Must be a whole number greater than 0
                  </Text>
                )}
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="fs-total-cap">Total cap</Label>
                <Input
                  id="fs-total-cap"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.total_cap}
                  onChange={(e) => setForm({ ...form, total_cap: e.target.value })}
                />
                {totalCap === undefined && (
                  <Text size="small" className="text-ui-fg-error">
                    Must be a whole number greater than 0
                  </Text>
                )}
                {capBelowSold && (
                  <Text size="small" className="text-ui-fg-subtle">
                    {unitsSold} units already sold — new checkouts will fail as sold out.
                  </Text>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="fs-show-countdown">Show countdown</Label>
                <Switch
                  id="fs-show-countdown"
                  checked={form.show_countdown}
                  onCheckedChange={(checked) => setForm({ ...form, show_countdown: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="fs-show-remaining">Show remaining</Label>
                <Switch
                  id="fs-show-remaining"
                  checked={form.show_remaining}
                  onCheckedChange={(checked) => setForm({ ...form, show_remaining: checked })}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="fs-banner-text">Banner text</Label>
                <Input
                  id="fs-banner-text"
                  value={form.banner_text}
                  onChange={(e) => setForm({ ...form, banner_text: e.target.value })}
                />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary" disabled={save.isPending}>
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={handleSave}
                disabled={invalid || save.isPending}
                isLoading={save.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "campaign.details",
})

export default FlashSaleOptionsWidget
