import { Form, KeyboundForm } from "@medusajs/dashboard/components"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, DatePicker, FocusModal, Heading, Input, Select, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { groupBuyApi, groupBuyKeys } from "../../lib/group-buy"
import {
  CAMPAIGN_PARSE_OPTIONS,
  CampaignBody,
  CampaignForm,
  campaignFormSchema,
  emptyCampaignForm,
  isEndsAtPast,
  newIdempotencyKey,
  toCampaignBody,
} from "../../lib/group-buy-form"
import { createSingleFlight } from "../../lib/single-flight"
import { NumberInput } from "../common/number-input"
import { ProductPicker } from "./product-picker"

type TextKey = {
  [K in keyof CampaignForm]: CampaignForm[K] extends string ? K : never
}[keyof CampaignForm]

const SELECTS: { key: "target_type" | "group_mode" | "discount_type"; label: string; options: string[] }[] = [
  { key: "target_type", label: "Target type *", options: ["orders", "units", "people"] },
  { key: "group_mode", label: "Group mode *", options: ["pool", "team", "both"] },
  { key: "discount_type", label: "Discount type *", options: ["percentage", "fixed"] },
]

// ADM-15 (spec 08 กฎ 19a): numeric = ช่องตัวเลขผ่าน NumberInput ของกลาง (กฎ 15)
type TextField = { key: TextKey; label: string; numeric?: boolean; hint?: string }

const NAME_AND_TARGET: TextField[] = [
  { key: "name", label: "Name *" },
  { key: "target_value", label: "Target value *", numeric: true },
]

// spec 08 กฎ 5: กรอกตาม timezone ของเครื่องแอดมิน (ต้องตั้งเป็นเวลาไทย) — ส่ง Date เข้า API ตรงๆ
const DATES: { key: "starts_at" | "ends_at"; label: string }[] = [
  { key: "starts_at", label: "Starts at" },
  { key: "ends_at", label: "Ends at *" },
]

const INPUTS: TextField[] = [
  { key: "discount_value", label: "Discount value *", numeric: true, hint: "Percent, or THB for fixed" },
  {
    key: "max_quantity",
    label: "Max discounted quantity per order *",
    numeric: true,
    hint: "Must be at least max units per person, or members join with units the discount does not cover",
  },
  { key: "team_duration_hours", label: "Team duration (hours)", numeric: true, hint: "Required for team/both" },
  { key: "max_total_orders", label: "Max total orders", numeric: true },
  { key: "max_units_per_person", label: "Max units per person", numeric: true },
  { key: "max_people_per_group", label: "Max people per group", numeric: true },
  { key: "pay_within_hours", label: "Pay within (hours) *", numeric: true },
]

// testid ของ error ใต้ช่องที่ e2e ใช้อยู่ (GB-6b2 / GB-6e)
const ERROR_TESTIDS: Partial<Record<keyof CampaignForm, string>> = {
  max_quantity: "gb-max-quantity-error",
  max_total_orders: "gb-max-total-orders-error", // ADM-15 (AC-19)
}

// GB-6a: สร้างแคมเปญ (status draft) — ส่วนลด/scope ไปอยู่ที่ promotion ต้นแบบ (ADR-011)
// ADM-7 (spec 08 AC-10, กฎ 8): Form + KeyboundForm ของ dashboard + zod (⌘/Ctrl+Enter ส่งได้); กฎธุรกิจยังอยู่ใน toCampaignBody
// แล้ว map error เข้า form.setError — error ที่ไม่ผูกช่องแสดงเป็น toast เหมือนเดิม
// ADM-13 (spec 08 กฎ 16, 18): controlled — ปุ่มเปิดอยู่ใน action ของ DataTable ที่หน้า list
export const CreateCampaign = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้ว parse ด้วย schema เดียวกันตอน submit (แบบ ADM-3)
  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignFormSchema, CAMPAIGN_PARSE_OPTIONS, { raw: true }),
    defaultValues: emptyCampaignForm(),
  })
  // spec 08 กฎ 4: dblclick / ⌘+Enter ซ้ำผ่าน validation พร้อมกันได้ — createSingleFlight ให้ POST ครั้งเดียว
  const [submitOnce] = useState(createSingleFlight)
  // GB-13 (กฎข้อ 33d): key เดียวต่อการเปิดฟอร์ม — submit ซ้ำหลัง network ล้มได้แคมเปญเดิม
  // ตั้งเมื่อ open เปลี่ยน false → true เท่านั้นด้วย newIdempotencyKey (GB-15: getRandomValues ใช้ได้ทั้ง http/https — ไม่ใช้ API ที่มีเฉพาะ secure context)
  const [idempotencyKey, setIdempotencyKey] = useState("")
  // ADM-15 (spec 08 กฎ 19b): ไม่มี FocusModal.Trigger (ปุ่มอยู่ใน action ของ DataTable) — Radix คืน focus ให้ trigger ไม่ได้
  // จึงจำ element ที่ focus อยู่ตอนเปิด (ปุ่ม "Create campaign") แล้วคืน focus เองตอนปิด
  const [opener, setOpener] = useState<HTMLElement | null>(null)

  // กดปุ่มเปิดซ้ำขณะเปิดอยู่ open ไม่เปลี่ยน → key เดิม (spec 08 กฎ 18)
  useEffect(() => {
    if (!open) return
    setIdempotencyKey(newIdempotencyKey())
    form.reset(emptyCampaignForm())
  }, [open, form])

  const create = useMutation({
    mutationFn: groupBuyApi.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.campaigns })
      toast.success("Campaign created as draft")
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = form.handleSubmit((values) =>
    submitOnce(async () => {
      const result = toCampaignBody(campaignFormSchema.parse(values, CAMPAIGN_PARSE_OPTIONS))
      if ("error" in result) {
        if (result.field === "max_quantity") {
          form.setError("max_quantity", { message: result.error })
        } else if (result.field === "product") {
          form.setError("product_id", { message: result.error })
        } else {
          toast.error(result.error)
        }
        return
      }
      // key ตั้งตอน modal เปิดจึงมีเสมอ; ถ้าว่างไม่ส่ง field (backend ไม่รับ key ว่าง)
      const body: CampaignBody = idempotencyKey ? { ...result.body, idempotency_key: idempotencyKey } : result.body
      await create.mutateAsync(body).catch(() => undefined)
    })
  )

  const endsAt = form.watch("ends_at")

  const textField = ({ key, label, numeric, hint }: TextField) => (
    <Form.Field
      key={key}
      control={form.control}
      name={key}
      render={({ field }) => (
        <Form.Item>
          <Form.Label>{label}</Form.Label>
          <Form.Control>
            {numeric ? (
              <NumberInput {...field} size="small" data-testid={`gb-field-${key}`} />
            ) : (
              <Input {...field} size="small" data-testid={`gb-field-${key}`} />
            )}
          </Form.Control>
          {hint && <Form.Hint>{hint}</Form.Hint>}
          <Form.ErrorMessage data-testid={ERROR_TESTIDS[key]} />
        </Form.Item>
      )}
    />
  )

  return (
    <FocusModal open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <FocusModal.Content
        // onOpenAutoFocus ยิงก่อน focus ย้ายเข้า modal — activeElement ยังเป็นปุ่มที่กดเปิด
        onOpenAutoFocus={() => setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null)}
        onCloseAutoFocus={(e) => {
          if (opener?.isConnected) {
            e.preventDefault()
            opener.focus()
          }
        }}
      >
        <Form {...form}>
          {/* noValidate: validation เป็นของ zod/toCampaignBody (error ใต้ช่อง) ไม่ให้ browser ดัก input number ก่อน */}
          <KeyboundForm noValidate onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  size="small"
                  type="submit"
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
                  <Form.Field
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field: { onChange, ref, ...field } }) => (
                      <Form.Item>
                        <Form.Label>{label}</Form.Label>
                        <Form.Control>
                          <Select {...field} size="small" onValueChange={onChange}>
                            <Select.Trigger ref={ref}>
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
                        </Form.Control>
                      </Form.Item>
                    )}
                  />
                ))}
                {NAME_AND_TARGET.map(textField)}
                {DATES.map(({ key, label }) => (
                  <Form.Field
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>{label}</Form.Label>
                        {/* e2e กรอกผ่าน wrapper ที่มี testid เดิม (fillDatePicker — spec 08 กฎ 7b) */}
                        <div data-testid={`gb-field-${key}`}>
                          <Form.Control>
                            <DatePicker {...field} granularity="minute" shouldCloseOnSelect={false} />
                          </Form.Control>
                        </div>
                        <Form.ErrorMessage />
                        {/* กฎข้อ 16: เตือนแต่ยังส่งได้ — activate จะถูก backend ปฏิเสธจนกว่าจะแก้ ends_at */}
                        {key === "ends_at" && isEndsAtPast(endsAt) && (
                          <Text size="xsmall" className="text-ui-tag-orange-text" data-testid="gb-ends-at-warning">
                            This end time has already passed. The campaign will be created as draft but cannot be
                            activated until the end time is in the future.
                          </Text>
                        )}
                      </Form.Item>
                    )}
                  />
                ))}
                {INPUTS.map(textField)}
                <Form.Field
                  control={form.control}
                  name="product_id"
                  render={({ field, fieldState }) => (
                    <ProductPicker
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Form.Field
                  control={form.control}
                  name="is_tax_inclusive"
                  render={({ field: { value, onChange, ...field } }) => (
                    <Form.Item className="flex-row items-center gap-x-2 space-y-0">
                      <Form.Control>
                        <Switch {...field} checked={value} onCheckedChange={onChange} />
                      </Form.Control>
                      <Form.Label>Discount is tax inclusive (THB prices include VAT)</Form.Label>
                    </Form.Item>
                  )}
                />
              </div>
            </FocusModal.Body>
          </KeyboundForm>
        </Form>
      </FocusModal.Content>
    </FocusModal>
  )
}
