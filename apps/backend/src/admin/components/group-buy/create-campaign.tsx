import { Form, KeyboundForm } from "@medusajs/dashboard/components"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, DatePicker, FocusModal, Heading, Input, Select, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import { useSingleFlight } from "../../lib/single-flight"
import { NumberInput } from "../common/number-input"
import { useConfirmDiscard } from "../common/use-confirm-discard"
import { useRestoreOpenerFocus } from "../common/use-restore-opener-focus"
import { ProductPicker } from "./product-picker"

type TextKey = {
  [K in keyof CampaignForm]: CampaignForm[K] extends string ? K : never
}[keyof CampaignForm]

// ADM-15 (spec 08 กฎ 19a): numeric = ช่องตัวเลขผ่าน NumberInput ของกลาง (กฎ 15)
type TextField = { key: TextKey; label: string; numeric?: boolean; hint?: string }

// ตัวเลือกของ select (ค่าที่ส่ง API) — ข้อความที่แสดงแปลด้วย key `<optionPrefix>.<ค่า>` (spec 10 กฎ 7)
const SELECT_OPTIONS = {
  target_type: { optionPrefix: "targetType", options: ["orders", "units", "people"] },
  group_mode: { optionPrefix: "groupMode", options: ["pool", "team", "both"] },
  discount_type: { optionPrefix: "discountType", options: ["percentage", "fixed"] },
} as const

// testid ของ error ใต้ช่องที่ e2e ใช้อยู่ (GB-6b2 / GB-6e)
const ERROR_TESTIDS: Partial<Record<keyof CampaignForm, string>> = {
  max_quantity: "gb-max-quantity-error",
  max_total_orders: "gb-max-total-orders-error", // ADM-15 (AC-19)
  // ADM-32 (spec 08 กฎ 36c): รูปค่าของช่องตัวเลขแสดงใต้ช่อง
  target_value: "gb-target-value-error",
  team_duration_hours: "gb-team-duration-hours-error",
  max_units_per_person: "gb-max-units-per-person-error",
  max_people_per_group: "gb-max-people-per-group-error",
  pay_within_hours: "gb-pay-within-hours-error",
  discount_value: "gb-discount-value-error",
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
  const { t } = useTranslation("ecom-group-buy")
  // spec 10 กฎ 4e (AI18N-2): label/hint ของช่องย้ายจากค่าคงที่ระดับ module เข้า component เพื่อเรียก t ตอน render (ลำดับช่องเดิม)
  const selects: { key: keyof typeof SELECT_OPTIONS; label: string }[] = [
    { key: "target_type", label: t("form.labels.targetType") },
    { key: "group_mode", label: t("form.labels.groupMode") },
    { key: "discount_type", label: t("form.labels.discountType") },
  ]
  const nameAndTarget: TextField[] = [
    { key: "name", label: t("form.labels.name") },
    { key: "target_value", label: t("form.labels.targetValue"), numeric: true },
  ]
  // spec 08 กฎ 5: กรอกตาม timezone ของเครื่องแอดมิน (ต้องตั้งเป็นเวลาไทย) — ส่ง Date เข้า API ตรงๆ
  const dates: { key: "starts_at" | "ends_at"; label: string }[] = [
    { key: "starts_at", label: t("form.labels.startsAt") },
    { key: "ends_at", label: t("form.labels.endsAt") },
  ]
  const inputs: TextField[] = [
    { key: "discount_value", label: t("form.labels.discountValue"), numeric: true, hint: t("form.hints.discountValue") },
    {
      key: "max_quantity",
      label: t("form.labels.maxQuantity"),
      numeric: true,
      hint: t("form.hints.maxQuantity"),
    },
    { key: "team_duration_hours", label: t("form.labels.teamDuration"), numeric: true, hint: t("form.hints.teamDuration") },
    { key: "max_total_orders", label: t("form.labels.maxTotalOrders"), numeric: true },
    { key: "max_units_per_person", label: t("form.labels.maxUnitsPerPerson"), numeric: true },
    { key: "max_people_per_group", label: t("form.labels.maxPeoplePerGroup"), numeric: true },
    { key: "pay_within_hours", label: t("form.labels.payWithin"), numeric: true },
  ]
  const queryClient = useQueryClient()
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้ว parse ด้วย schema เดียวกันตอน submit (แบบ ADM-3)
  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignFormSchema, CAMPAIGN_PARSE_OPTIONS, { raw: true }),
    defaultValues: emptyCampaignForm(),
  })
  // spec 08 กฎ 4: dblclick / ⌘+Enter ซ้ำผ่าน validation พร้อมกันได้ — createSingleFlight ให้ POST ครั้งเดียว
  // กฎ 43 (ADM-39): สำเร็จแล้ว hold ระหว่าง modal กำลังปิด — release ตอนเปิดใหม่ (effect ด้านล่าง)
  // กฎ 50 (ADM-46): `submitLocked` = in-flight หรือ hold — Create disabled ตลอดช่วงแอนิเมชันปิด
  const [submitOnce, submitLocked] = useSingleFlight()
  // GB-13 (กฎข้อ 33d): key เดียวต่อการเปิดฟอร์ม — submit ซ้ำหลัง network ล้มได้แคมเปญเดิม
  // ตั้งเมื่อ open เปลี่ยน false → true เท่านั้นด้วย newIdempotencyKey (GB-15: getRandomValues ใช้ได้ทั้ง http/https — ไม่ใช้ API ที่มีเฉพาะ secure context)
  const [idempotencyKey, setIdempotencyKey] = useState("")

  // กดปุ่มเปิดซ้ำขณะเปิดอยู่ open ไม่เปลี่ยน → key เดิม (spec 08 กฎ 18)
  useEffect(() => {
    if (!open) return
    setIdempotencyKey(newIdempotencyKey())
    form.reset(emptyCampaignForm())
    submitOnce.release()
  }, [open, form, submitOnce])

  const create = useMutation({
    mutationFn: groupBuyApi.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.campaigns })
      toast.success(t("form.created"))
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
      await create.mutateAsync(body).then(submitOnce.hold, () => undefined)
    })
  )

  const endsAt = form.watch("ends_at")
  // ADM-34 (spec 08 กฎ 38): ปิดแล้ว focus กลับปุ่มที่เปิด
  const restoreFocus = useRestoreOpenerFocus()
  // ADM-27 (spec 08 กฎ 31): ฟอร์ม dirty ถามก่อนปิด; ระหว่างบันทึกไม่ปิด (เงื่อนไขเดิม)
  const confirmClose = useConfirmDiscard({
    form,
    isPending: create.isPending,
    onClose: () => onOpenChange(false),
  })

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
    <FocusModal open={open} onOpenChange={confirmClose}>
      <FocusModal.Content {...restoreFocus}>
        <Form {...form}>
          {/* noValidate: validation เป็นของ zod/toCampaignBody (error ใต้ช่อง) ไม่ให้ browser ดัก input number ก่อน */}
          <KeyboundForm noValidate onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  size="small"
                  type="submit"
                  isLoading={create.isPending}
                  disabled={submitLocked}
                  data-testid="gb-campaign-create-submit"
                >
                  {t("actions.create", { ns: "translation" })}
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex justify-center overflow-auto py-16">
              <div className="flex w-full max-w-lg flex-col gap-y-4">
                <FocusModal.Title asChild>
                  <Heading>{t("form.title")}</Heading>
                </FocusModal.Title>
                <Text size="small" className="text-ui-fg-subtle">
                  {t("form.description")}
                </Text>
                {selects.map(({ key, label }) => (
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
                              {SELECT_OPTIONS[key].options.map((o) => (
                                <Select.Item key={o} value={o}>
                                  {t(`${SELECT_OPTIONS[key].optionPrefix}.${o}`, { defaultValue: o })}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </Form.Control>
                      </Form.Item>
                    )}
                  />
                ))}
                {nameAndTarget.map(textField)}
                {dates.map(({ key, label }) => (
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
                            {t("form.endsAtPast")}
                          </Text>
                        )}
                      </Form.Item>
                    )}
                  />
                ))}
                {inputs.map(textField)}
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
                      <Form.Label>{t("form.labels.taxInclusive")}</Form.Label>
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
