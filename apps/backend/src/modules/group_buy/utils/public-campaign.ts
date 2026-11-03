import type { GroupBuyCampaignStatus } from "./campaign-status"
import { assertCampaignInWindow } from "./group-creation"

// spec 04 กฎข้อ 28 (GB-11): response ของ route สาธารณะ — allow-list ประกอบทีละ field ไม่ spread entity (ADR-016 ทางเลือก D)

type DateLike = string | Date | null | undefined
type Rule = {
  attribute: string
  operator: string
  values?: { value: string }[] | null
}
export type PublicApplicationMethod = {
  type: string
  value: number | string
  currency_code?: string | null
  target_rules?: Rule[] | null
}

const PRODUCT_ATTRIBUTE = "items.product.id"
const iso = (d: DateLike) => (d ? new Date(d).toISOString() : null)

// กฎข้อ 28e + 30: ค่าเดียวใน values ของ rule `items.product.id` / `in` — ไม่มี rule, หลาย rule, ≠ 1 ค่า
// หรือมี rule อื่นของ `items.*` ปน (ห้าม scope ระดับ variant/attribute อื่น) → null; rule นอก `items.*` ไม่อยู่ในกฎนี้
export function publicCampaignProductId(method: Pick<PublicApplicationMethod, "target_rules"> | null | undefined) {
  const itemRules = (method?.target_rules ?? []).filter((r) => r.attribute.startsWith("items."))
  const rules = itemRules.filter((r) => r.attribute === PRODUCT_ATTRIBUTE && r.operator === "in")
  if (rules.length !== itemRules.length) {
    return null
  }
  const values = rules.length === 1 ? (rules[0].values ?? []) : []
  return values.length === 1 ? values[0].value : null
}

// currency_code มีความหมายเฉพาะส่วนลดแบบ fixed
export function publicDiscount(method: PublicApplicationMethod | null | undefined) {
  if (!method) {
    return null
  }
  return {
    type: method.type,
    value: Number(method.value),
    currency_code: method.type === "percentage" ? null : (method.currency_code ?? null),
  }
}

// กฎข้อ 28c: เงื่อนไขเดียวกับที่ join/สร้างกลุ่มยอมรับ (กฎข้อ 10) — ใช้ตัวตรวจเดิมเพื่อไม่ให้เกณฑ์แยกกัน
export function isCampaignLive(
  c: { status: GroupBuyCampaignStatus; starts_at: DateLike; ends_at: DateLike },
  now: Date
): boolean {
  try {
    assertCampaignInWindow({
      campaignStatus: c.status,
      startsAt: c.starts_at ? new Date(c.starts_at) : null,
      endsAt: c.ends_at ? new Date(c.ends_at) : null,
      now,
    })
    return true
  } catch {
    return false
  }
}

export type PublicCampaignSource = {
  id: string
  name: string
  target_type: string
  target_value: number
  group_mode: string
  max_people_per_group: number | null
  max_units_per_person: number | null
  team_duration_hours: number | null
  pay_within_hours: number
  campaign?: ({ starts_at?: DateLike; ends_at?: DateLike } & Record<string, unknown>) | null
} & Record<string, unknown>

// promotion = ต้นแบบ (รายการแคมเปญ) หรือ promotion ของกลุ่ม (หน้ากลุ่ม) ตามกฎข้อ 28e
export const toPublicCampaign = (
  c: PublicCampaignSource,
  promotion: ({ application_method?: PublicApplicationMethod | null } & Record<string, unknown>) | null | undefined
) => ({
  id: c.id,
  name: c.name,
  starts_at: iso(c.campaign?.starts_at),
  ends_at: iso(c.campaign?.ends_at),
  target_type: c.target_type,
  target_value: c.target_value,
  group_mode: c.group_mode,
  max_people_per_group: c.max_people_per_group,
  max_units_per_person: c.max_units_per_person,
  team_duration_hours: c.team_duration_hours,
  pay_within_hours: c.pay_within_hours,
  discount: publicDiscount(promotion?.application_method),
  product_id: publicCampaignProductId(promotion?.application_method),
})

export type PublicGroupSource = {
  id: string
  name: string | null
  join_token: string
  status: string
  starts_at: DateLike
  ends_at: DateLike
  progress_orders: number
  progress_units: number
  progress_people: number
} & Record<string, unknown>

export const toPublicGroup = (g: PublicGroupSource) => ({
  id: g.id,
  name: g.name,
  join_token: g.join_token,
  status: g.status,
  starts_at: iso(g.starts_at),
  ends_at: iso(g.ends_at),
  progress_orders: g.progress_orders,
  progress_units: g.progress_units,
  progress_people: g.progress_people,
})

// field ของ application_method ที่ทั้งสอง route อ่าน (prefix = path ของ promotion ใน query.graph)
export const applicationMethodFields = (prefix: string) =>
  [
    "application_method.type",
    "application_method.value",
    "application_method.currency_code",
    "application_method.target_rules.attribute",
    "application_method.target_rules.operator",
    "application_method.target_rules.values.value",
  ].map((f) => `${prefix}.${f}`)

export const CAMPAIGN_CONFIG_FIELDS = [
  "id",
  "name",
  "status",
  "target_type",
  "target_value",
  "group_mode",
  "max_people_per_group",
  "max_units_per_person",
  "team_duration_hours",
  "pay_within_hours",
  "campaign.starts_at",
  "campaign.ends_at",
]

export const GROUP_FIELDS = [
  "id",
  "name",
  "kind",
  "join_token",
  "status",
  "starts_at",
  "ends_at",
  "progress_orders",
  "progress_units",
  "progress_people",
]
