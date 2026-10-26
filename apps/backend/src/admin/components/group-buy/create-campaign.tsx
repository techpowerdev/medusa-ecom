import { Button, FocusModal, Heading, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { groupBuyApi, groupBuyKeys } from "../../lib/group-buy"
import { CampaignForm, emptyCampaignForm, toCampaignBody } from "../../lib/group-buy-form"

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
  { key: "max_quantity", label: "Max discounted quantity per order *", type: "number" },
  { key: "team_duration_hours", label: "Team duration (hours)", type: "number", hint: "Required for team/both" },
  { key: "max_total_orders", label: "Max total orders", type: "number" },
  { key: "max_units_per_person", label: "Max units per person", type: "number" },
  { key: "max_people_per_group", label: "Max people per group", type: "number" },
  { key: "pay_within_hours", label: "Pay within (hours) *", type: "number" },
  {
    key: "product_ids",
    label: "Product IDs (comma separated)",
    hint: "Empty = all products. Scope can be refined later on the template promotion.",
  },
]

// GB-6a: สร้างแคมเปญ (status draft) — ส่วนลด/scope ไปอยู่ที่ promotion ต้นแบบ (ADR-011)
export const CreateCampaign = () => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyCampaignForm())
  // GB-6a D1: in-flight guard แบบ synchronous — isPending ยังไม่เปลี่ยนระหว่างคลิกใน task เดียว
  const inFlight = useRef(false)
  const set = (patch: Partial<CampaignForm>) => setForm((f) => ({ ...f, ...patch }))

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
      toast.error(result.error)
      return
    }
    inFlight.current = true
    create.mutate(result.body)
  }

  const openModal = () => {
    setForm(emptyCampaignForm())
    setOpen(true)
  }

  return (
    <>
      <Button size="small" variant="secondary" onClick={openModal}>
        Create campaign
      </Button>
      <FocusModal open={open} onOpenChange={(o) => !inFlight.current && setOpen(o)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <Button size="small" onClick={submit} isLoading={create.isPending} disabled={create.isPending}>
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
                  />
                  {hint && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {hint}
                    </Text>
                  )}
                </div>
              ))}
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
