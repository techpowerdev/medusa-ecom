import { Button, FocusModal, Heading, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { groupBuyApi, groupBuyKeys } from "../../lib/group-buy"
import { CampaignForm, emptyCampaignForm, isEndsAtPast, toCampaignBody } from "../../lib/group-buy-form"
import { ProductPicker } from "./product-picker"

type TextKey = {
  [K in keyof CampaignForm]: CampaignForm[K] extends string ? K : never
}[keyof CampaignForm]

const SELECTS: { key: TextKey; label: string; options: string[] }[] = [
  { key: "target_type", label: "Target type *", options: ["orders", "units", "people"] },
  { key: "group_mode", label: "Group mode *", options: ["pool", "team", "both"] },
  { key: "discount_type", label: "Discount type *", options: ["percentage", "fixed"] },
]

const INPUTS: { key: TextKey; label: string; type?: string; hint?: string }[] = [
  { key: "name", label: "Name *" },
  { key: "target_value", label: "Target value *", type: "number" },
  { key: "starts_at", label: "Starts at (ICT)", type: "datetime-local" },
  { key: "ends_at", label: "Ends at (ICT) *", type: "datetime-local" },
  { key: "discount_value", label: "Discount value *", type: "number", hint: "Percent, or THB for fixed" },
  {
    key: "max_quantity",
    label: "Max discounted quantity per order *",
    type: "number",
    hint: "Must be at least max units per person, or members join with units the discount does not cover",
  },
  { key: "team_duration_hours", label: "Team duration (hours)", type: "number", hint: "Required for team/both" },
  { key: "max_total_orders", label: "Max total orders", type: "number" },
  { key: "max_units_per_person", label: "Max units per person", type: "number" },
  { key: "max_people_per_group", label: "Max people per group", type: "number" },
  { key: "pay_within_hours", label: "Pay within (hours) *", type: "number" },
]

// GB-6a: สร้างแคมเปญ (status draft) — ส่วนลด/scope ไปอยู่ที่ promotion ต้นแบบ (ADR-011)
export const CreateCampaign = () => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyCampaignForm())
  // GB-6b2 กฎข้อ 15: error ผูกกับช่อง max_quantity (ล้างเมื่อแก้ฟอร์ม)
  const [maxQuantityError, setMaxQuantityError] = useState<string | null>(null)
  // GB-6a D1: in-flight guard แบบ synchronous — isPending ยังไม่เปลี่ยนระหว่างคลิกใน task เดียว
  const inFlight = useRef(false)
  const set = (patch: Partial<CampaignForm>) => {
    setMaxQuantityError(null)
    setForm((f) => ({ ...f, ...patch }))
  }

  const create = useMutation({
    mutationFn: groupBuyApi.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.campaigns })
      toast.success("Campaign created as draft")
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      inFlight.current = false
    },
  })

  const submit = () => {
    // กันกดซ้ำ: ไม่ยิงซ้ำถ้ายังมี request ค้าง (ref) + ปุ่ม disabled ระหว่างส่ง
    if (inFlight.current) {
      return
    }
    const result = toCampaignBody(form)
    if ("error" in result) {
      if (result.field === "max_quantity") {
        setMaxQuantityError(result.error)
      } else {
        toast.error(result.error)
      }
      return
    }
    inFlight.current = true
    create.mutate(result.body)
  }

  const openModal = () => {
    setForm(emptyCampaignForm())
    setMaxQuantityError(null)
    setOpen(true)
  }

  return (
    <>
      <Button size="small" variant="secondary" onClick={openModal} data-testid="gb-campaign-create">
        Create campaign
      </Button>
      <FocusModal open={open} onOpenChange={(o) => !inFlight.current && setOpen(o)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <Button
                size="small"
                onClick={submit}
                isLoading={create.isPending}
                disabled={create.isPending}
                data-testid="gb-campaign-create-submit"
              >
                Create
              </Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex justify-center overflow-auto py-16">
            <div className="flex w-full max-w-lg flex-col gap-y-4">
              <Heading>Create group-buy campaign</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                The campaign starts as draft. Activate it from the campaign page when ready.
              </Text>
              {SELECTS.map(({ key, label, options }) => (
                <div key={key} className="flex flex-col gap-y-2">
                  <Label size="small">{label}</Label>
                  <Select size="small" value={form[key]} onValueChange={(v) => set({ [key]: v })}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {options.map((o) => (
                        <Select.Item key={o} value={o}>
                          {o}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              ))}
              {INPUTS.map(({ key, label, type, hint }) => (
                <div key={key} className="flex flex-col gap-y-2">
                  <Label size="small">{label}</Label>
                  <Input
                    size="small"
                    type={type ?? "text"}
                    value={form[key]}
                    onChange={(e) => set({ [key]: e.target.value })}
                    aria-invalid={key === "max_quantity" && !!maxQuantityError}
                    data-testid={`gb-field-${key}`}
                  />
                  {hint && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {hint}
                    </Text>
                  )}
                  {key === "max_quantity" && maxQuantityError && (
                    <Text size="xsmall" className="text-ui-fg-error" data-testid="gb-max-quantity-error">
                      {maxQuantityError}
                    </Text>
                  )}
                  {/* กฎข้อ 16: เตือนแต่ยังส่งได้ — activate จะถูก backend ปฏิเสธจนกว่าจะแก้ ends_at */}
                  {key === "ends_at" && isEndsAtPast(form.ends_at) && (
                    <Text size="xsmall" className="text-ui-tag-orange-text" data-testid="gb-ends-at-warning">
                      This end time has already passed. The campaign will be created as draft but cannot be
                      activated until the end time is in the future.
                    </Text>
                  )}
                </div>
              ))}
              <ProductPicker value={form.product_ids} onChange={(product_ids) => set({ product_ids })} />
              <div className="flex items-center gap-x-2">
                <Switch
                  id="gb-tax-inclusive"
                  checked={form.is_tax_inclusive}
                  onCheckedChange={(checked) => set({ is_tax_inclusive: checked })}
                />
                <Label size="small" htmlFor="gb-tax-inclusive">
                  Discount is tax inclusive (THB prices include VAT)
                </Label>
              </div>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </>
  )
}
