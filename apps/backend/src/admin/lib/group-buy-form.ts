import { z } from "zod"
import { INT4_MAX } from "../../lib/int4"
import { t } from "../i18n/t"
import { BAD_NUMBER_INPUT, fieldErrorMap } from "./form-validation"

// GB-6a: แปลงค่าฟอร์ม "Create campaign" เป็น body ของ POST /admin/group-buy/campaigns
// pure — ไม่ import sdk เพื่อให้ unit test ตรวจกับ validator ของ GB-2a/GB-2c ได้
// ADM-7 (spec 08 กฎ 5, 8): ฟอร์มเป็น react-hook-form — schema ตรวจรูปค่า (วันเวลาเป็น Date จาก DatePicker ตาม timezone
// ของเครื่องแอดมิน), กฎธุรกิจอยู่ใน toCampaignBody แล้ว map error เข้า form.setError
export type TargetType = "orders" | "units" | "people"
export type GroupMode = "pool" | "team" | "both"

// spec 10 กฎ 4d (AI18N-2): ข้อความเป็น function เรียก t ตอน validate (ห้ามเรียกตอนโหลด module) — ค่า en เท่าข้อความเดิม
// ชื่อช่องในข้อความเป็น key ของตัวเอง (กฎ 3) ส่งต่อเป็นชื่อ key ไม่ใช่ข้อความ
type FieldName =
  | "target"
  | "teamDuration"
  | "maxTotalOrders"
  | "maxUnitsPerPerson"
  | "maxPeoplePerGroup"
  | "payWithin"
  | "maxQuantity"
  | "endDate"

// key literal ทุกตัว (unit AC-3 ตรวจ key ได้) — เรียกตอน validate เท่านั้น
const FIELD_NAMES: Record<FieldName, () => string> = {
  target: () => t("ecom-group-buy", "form.fieldNames.target"),
  teamDuration: () => t("ecom-group-buy", "form.fieldNames.teamDuration"),
  maxTotalOrders: () => t("ecom-group-buy", "form.fieldNames.maxTotalOrders"),
  maxUnitsPerPerson: () => t("ecom-group-buy", "form.fieldNames.maxUnitsPerPerson"),
  maxPeoplePerGroup: () => t("ecom-group-buy", "form.fieldNames.maxPeoplePerGroup"),
  payWithin: () => t("ecom-group-buy", "form.fieldNames.payWithin"),
  maxQuantity: () => t("ecom-group-buy", "form.fieldNames.maxQuantity"),
  endDate: () => t("ecom-group-buy", "form.fieldNames.endDate"),
}

const invalidDate = () => t("ecom-group-buy", "form.errors.invalidDate")
const wholeNumberMessage = (name: FieldName) =>
  t("ecom-group-buy", "form.errors.wholeNumber", { label: FIELD_NAMES[name]() })
const discountValueMessage = () => t("ecom-group-buy", "form.errors.discountValue")

// ADM-15 (spec 08 กฎ 19a): ช่องตัวเลขเป็น NumberInput — ค่าที่ไม่ใช่ตัวเลข ("e") มาเป็น BAD_NUMBER_INPUT
// ปฏิเสธที่ schema ให้ error อยู่ใต้ช่อง (ข้อความเดียวกับ toCampaignBody) ค่าว่างยังผ่านไปให้ toCampaignBody ตัดสิน
// ADM-32 (spec 08 กฎ 36): รูปค่า (จำนวนเต็ม > 0 และ ≤ INT4_MAX ของ column int4 — GB-17; discount > 0) ตรวจที่นี่ด้วย
// ให้ error อยู่ใต้ช่องแทน toast — issue เดียวต่อช่อง (ข้อความแรกที่เข้าเงื่อนไข)
const numberText = (issueOf: (n: number) => string | null, badInput: () => string) =>
  z.string().superRefine((value, ctx) => {
    const message = value === BAD_NUMBER_INPUT ? badInput() : value.trim() ? issueOf(Number(value)) : null
    if (message) ctx.addIssue({ code: "custom", message })
  })

const wholeNumberText = (name: FieldName) =>
  numberText(
    (n) => {
      if (!Number.isInteger(n) || n <= 0) return wholeNumberMessage(name)
      return n > INT4_MAX ? t("ecom-group-buy", "form.errors.atMost", { label: FIELD_NAMES[name](), max: INT4_MAX }) : null
    },
    () => wholeNumberMessage(name)
  )

const discountText = numberText((n) => (n > 0 ? null : discountValueMessage()), discountValueMessage)

export const campaignFormSchema = z.object({
  name: z.string(),
  target_type: z.enum(["orders", "units", "people"]),
  target_value: wholeNumberText("target"),
  group_mode: z.enum(["pool", "team", "both"]),
  team_duration_hours: wholeNumberText("teamDuration"),
  max_total_orders: wholeNumberText("maxTotalOrders"),
  max_units_per_person: wholeNumberText("maxUnitsPerPerson"),
  max_people_per_group: wholeNumberText("maxPeoplePerGroup"),
  pay_within_hours: wholeNumberText("payWithin"),
  starts_at: z.date().nullable(),
  ends_at: z.date().nullable(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: discountText,
  max_quantity: wholeNumberText("maxQuantity"),
  product_id: z.string().nullable(), // GB-6e (spec 04 กฎข้อ 30): 1 แคมเปญ = 1 สินค้า จาก product picker — บังคับเลือก
  is_tax_inclusive: z.boolean(), // spec 04 กฎข้อ 12
})
export type CampaignForm = z.input<typeof campaignFormSchema>

// z.date() กับ Invalid Date/ค่าที่ไม่ใช่ Date ให้ "Invalid input" — แทนด้วยข้อความของช่อง (ADM-3 fieldErrorMap)
export const CAMPAIGN_PARSE_OPTIONS = {
  error: fieldErrorMap({ starts_at: invalidDate, ends_at: invalidDate }),
}

export const emptyCampaignForm = (): CampaignForm => ({
  name: "",
  target_type: "orders",
  target_value: "",
  group_mode: "pool",
  team_duration_hours: "",
  max_total_orders: "",
  max_units_per_person: "",
  max_people_per_group: "",
  pay_within_hours: "24",
  starts_at: null,
  ends_at: null,
  discount_type: "percentage",
  discount_value: "",
  max_quantity: "10",
  product_id: null,
  is_tax_inclusive: true,
})

type FormField = "max_quantity" | "product"

class FormError extends Error {
  constructor(message: string, readonly field?: FormField) {
    super(message)
  }
}

const intOrNull = (value: string, name: FieldName) => {
  if (!value.trim()) {
    return null
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new FormError(wholeNumberMessage(name))
  }
  return n
}

const required = <T>(value: T | null, name: FieldName): T => {
  if (value === null) {
    throw new FormError(t("ecom-group-buy", "form.errors.required", { label: FIELD_NAMES[name]() }))
  }
  return value
}

// Date จาก DatePicker ส่งเข้า body ตรงๆ (JSON เป็น ISO UTC; validator ของ backend coerce)
const validDate = (value: Date | null) => {
  if (value && Number.isNaN(value.getTime())) {
    throw new FormError(invalidDate())
  }
  return value
}

// GB-6e (AC-50): selection ของ DataTable → สินค้าเดียว — id ใหม่ที่ไม่ใช่ตัวเดิมแทนตัวเดิม; ยกเลิกตัวเดิม = null
export const selectSingleProduct = (current: string | null, next: Record<string, boolean>): string | null => {
  const selected = Object.keys(next).filter((id) => next[id])
  return selected.find((id) => id !== current) ?? (current && selected.includes(current) ? current : null)
}

// GB-15 (กฎข้อ 33d): key รูป UUID v4 (RFC 4122) จาก crypto.getRandomValues — มีทั้งบนหน้า http และ https
export const newIdempotencyKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// GB-6b2 กฎข้อ 16: ends_at ที่ไม่อยู่ในอนาคตแค่เตือน (แคมเปญเป็น draft; backend ปฏิเสธ activate เอง)
export const isEndsAtPast = (endsAt: Date | null, now = Date.now()) =>
  endsAt !== null && endsAt.getTime() <= now

const buildBody = (form: CampaignForm) => {
  const name = form.name.trim()
  if (!name) {
    throw new FormError(t("ecom-group-buy", "form.errors.nameRequired"))
  }
  const starts_at = validDate(form.starts_at)
  const ends_at = required(validDate(form.ends_at), "endDate")
  if (starts_at && starts_at.getTime() >= ends_at.getTime()) {
    throw new FormError(t("ecom-group-buy", "form.errors.endAfterStart"))
  }
  const team_duration_hours = intOrNull(form.team_duration_hours, "teamDuration")
  if (form.group_mode !== "pool" && team_duration_hours === null) {
    throw new FormError(t("ecom-group-buy", "form.errors.teamDurationRequired"))
  }
  const value = Number(form.discount_value)
  if (!form.discount_value.trim() || !(value > 0)) {
    throw new FormError(discountValueMessage())
  }
  if (form.discount_type === "percentage" && value > 100) {
    throw new FormError(t("ecom-group-buy", "form.errors.percentageMax"))
  }
  if (!form.product_id) {
    throw new FormError(t("ecom-group-buy", "form.errors.product"), "product")
  }
  const max_units_per_person = intOrNull(form.max_units_per_person, "maxUnitsPerPerson")
  const max_quantity = required(intOrNull(form.max_quantity, "maxQuantity"), "maxQuantity")
  // กฎข้อ 15: ไม่เช่นนั้นสมาชิก join ด้วยจำนวนชิ้นที่ส่วนลดไม่ครอบ (ตรวจในฟอร์มเท่านั้น — Q10)
  if (max_units_per_person !== null && max_quantity < max_units_per_person) {
    throw new FormError(t("ecom-group-buy", "form.errors.maxQuantityBelowUnits"), "max_quantity")
  }

  return {
    name,
    target_type: form.target_type,
    target_value: required(intOrNull(form.target_value, "target"), "target"),
    group_mode: form.group_mode,
    team_duration_hours,
    max_total_orders: intOrNull(form.max_total_orders, "maxTotalOrders"),
    max_units_per_person,
    max_people_per_group: intOrNull(form.max_people_per_group, "maxPeoplePerGroup"),
    pay_within_hours: required(intOrNull(form.pay_within_hours, "payWithin"), "payWithin"),
    starts_at,
    ends_at,
    is_tax_inclusive: form.is_tax_inclusive,
    application_method: {
      type: form.discount_type,
      target_type: "items" as const,
      allocation: "each" as const,
      max_quantity,
      value,
      // ราคาร้านเป็น THB; ส่วนลด fixed ของ Medusa ต้องมี currency_code
      ...(form.discount_type === "fixed" ? { currency_code: "thb" } : {}),
      target_rules: [{ attribute: "items.product.id", operator: "in" as const, values: [form.product_id] }],
    },
  }
}
// idempotency_key: ฟอร์มใส่ต่อการเปิด FocusModal (GB-13, กฎข้อ 33d)
export type CampaignBody = ReturnType<typeof buildBody> & { idempotency_key?: string }

export const toCampaignBody = (
  form: CampaignForm
): { body: CampaignBody } | { error: string; field?: FormField } => {
  try {
    return { body: buildBody(form) }
  } catch (e) {
    if (e instanceof FormError) {
      return e.field ? { error: e.message, field: e.field } : { error: e.message }
    }
    throw e
  }
}
