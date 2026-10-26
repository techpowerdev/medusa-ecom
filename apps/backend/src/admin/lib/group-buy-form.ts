// GB-6a: แปลงค่าฟอร์ม "Create campaign" (string ทั้งหมด) เป็น body ของ POST /admin/group-buy/campaigns
// pure — ไม่ import sdk เพื่อให้ unit test ตรวจกับ validator ของ GB-2a/GB-2c ได้
export type TargetType = "orders" | "units" | "people"
export type GroupMode = "pool" | "team" | "both"

export const emptyCampaignForm = () => ({
  name: "",
  target_type: "orders" as TargetType,
  target_value: "",
  group_mode: "pool" as GroupMode,
  team_duration_hours: "",
  max_total_orders: "",
  max_units_per_person: "",
  max_people_per_group: "",
  pay_within_hours: "24",
  starts_at: "", // <input type="datetime-local"> ตีความเป็นเวลาไทย (ICT)
  ends_at: "",
  discount_type: "percentage" as "percentage" | "fixed",
  discount_value: "",
  max_quantity: "10",
  product_ids: [] as string[], // GB-6b2: จาก product picker; ว่าง = ทุกสินค้า (แก้ scope ภายหลังที่หน้า promotion ของ Medusa ได้)
  is_tax_inclusive: true, // spec 04 กฎข้อ 12
})
export type CampaignForm = ReturnType<typeof emptyCampaignForm>

type FormField = "max_quantity"

class FormError extends Error {
  constructor(message: string, readonly field?: FormField) {
    super(message)
  }
}

const intOrNull = (value: string, label: string) => {
  if (!value.trim()) {
    return null
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new FormError(`${label} must be a whole number greater than 0`)
  }
  return n
}

const required = <T>(value: T | null, label: string): T => {
  if (value === null) {
    throw new FormError(`${label} is required`)
  }
  return value
}

// ร้านอยู่ไทย: เวลาที่กรอกเป็น ICT ไม่ขึ้นกับ timezone ของ browser
const ictToIso = (value: string) => {
  if (!value) {
    return null
  }
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`)
  if (Number.isNaN(date.getTime())) {
    throw new FormError("Invalid date")
  }
  return date.toISOString()
}

// GB-6b2 กฎข้อ 16: ends_at ที่ไม่อยู่ในอนาคตแค่เตือน (แคมเปญเป็น draft; backend ปฏิเสธ activate เอง)
export const isEndsAtPast = (endsAt: string, now = Date.now()) => {
  try {
    const iso = ictToIso(endsAt)
    return iso !== null && Date.parse(iso) <= now
  } catch {
    return false
  }
}

const buildBody = (form: CampaignForm) => {
  const name = form.name.trim()
  if (!name) {
    throw new FormError("Name is required")
  }
  const starts_at = ictToIso(form.starts_at)
  const ends_at = required(ictToIso(form.ends_at), "End date")
  if (starts_at && starts_at >= ends_at) {
    throw new FormError("End date must be after start date")
  }
  const team_duration_hours = intOrNull(form.team_duration_hours, "Team duration")
  if (form.group_mode !== "pool" && team_duration_hours === null) {
    throw new FormError("Team duration is required when teams are allowed")
  }
  const value = Number(form.discount_value)
  if (!form.discount_value.trim() || !(value > 0)) {
    throw new FormError("Discount value must be a number greater than 0")
  }
  if (form.discount_type === "percentage" && value > 100) {
    throw new FormError("Percentage discount cannot exceed 100")
  }
  const productIds = form.product_ids
  const max_units_per_person = intOrNull(form.max_units_per_person, "Max units per person")
  const max_quantity = required(intOrNull(form.max_quantity, "Max quantity"), "Max quantity")
  // กฎข้อ 15: ไม่เช่นนั้นสมาชิก join ด้วยจำนวนชิ้นที่ส่วนลดไม่ครอบ (ตรวจในฟอร์มเท่านั้น — Q10)
  if (max_units_per_person !== null && max_quantity < max_units_per_person) {
    throw new FormError("Max discounted quantity must be at least max units per person", "max_quantity")
  }

  return {
    name,
    target_type: form.target_type,
    target_value: required(intOrNull(form.target_value, "Target"), "Target"),
    group_mode: form.group_mode,
    team_duration_hours,
    max_total_orders: intOrNull(form.max_total_orders, "Max total orders"),
    max_units_per_person,
    max_people_per_group: intOrNull(form.max_people_per_group, "Max people per group"),
    pay_within_hours: required(intOrNull(form.pay_within_hours, "Pay within"), "Pay within"),
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
      ...(productIds.length
        ? { target_rules: [{ attribute: "items.product.id", operator: "in" as const, values: productIds }] }
        : {}),
    },
  }
}
export type CampaignBody = ReturnType<typeof buildBody>

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
