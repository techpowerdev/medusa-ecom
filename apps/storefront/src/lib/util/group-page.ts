// GB-7a1 (spec 04 กฎข้อ 29b, AC-16a): logic ล้วนของหน้ากลุ่ม `/<cc>/g/<token>` — อ่านจาก response ของ GB-11 เท่านั้น ไม่มี I/O
import { convertToLocale } from "./money"
import { MAX_LINE_ITEM_QUANTITY, clampLineItemQuantity } from "./pending-add-to-cart"

type TargetType = "orders" | "units" | "people"

/** `Group & { kind }` ของ `GET /store/group-buy/groups/:token` (GB-11, กฎข้อ 28) */
export type PublicGroupBuyGroup = {
  id: string
  name: string | null
  join_token: string
  status: "open" | "succeeded" | "failed"
  kind: "pool" | "team"
  starts_at: string | null
  ends_at: string | null
  progress_orders: number
  progress_units: number
  progress_people: number
}

export type GroupBuyDiscount = { type: string; value: number; currency_code: string | null }

/** `Campaign` ของ GB-11 — ส่วนลด/สินค้าอ่านจาก promotion ของกลุ่ม (กฎข้อ 28e) */
export type PublicGroupBuyCampaign = {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  target_type: TargetType
  target_value: number
  group_mode: "pool" | "team" | "both"
  max_people_per_group: number | null
  max_units_per_person: number | null
  team_duration_hours: number | null
  pay_within_hours: number
  discount: GroupBuyDiscount | null
  product_id: string | null
}

export type PublicGroupBuyGroupView = { group: PublicGroupBuyGroup; campaign: PublicGroupBuyCampaign }

const PROGRESS: Record<TargetType, { key: keyof PublicGroupBuyGroup; unit: string }> = {
  people: { key: "progress_people", unit: "คน" },
  orders: { key: "progress_orders", unit: "คำสั่งซื้อ" },
  units: { key: "progress_units", unit: "ชิ้น" },
}

/** ความคืบหน้าตาม `target_type` ของแคมเปญ; แถบเต็มที่ 100% เมื่อเกินเป้าหมาย */
export function groupProgress(group: PublicGroupBuyGroup, campaign: PublicGroupBuyCampaign) {
  const { key, unit } = PROGRESS[campaign.target_type]
  const current = Number(group[key]) || 0
  const target = campaign.target_value
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100
  return { current, target, percent, unit }
}

/** มูลค่าส่วนลดของ promotion ของกลุ่ม: `10%` หรือจำนวนเงินตามสกุลเงิน (fixed) */
export function groupDiscountValue(discount: GroupBuyDiscount | null): string | null {
  if (!discount) return null
  if (discount.type === "percentage") return `${discount.value}%`
  return convertToLocale({ amount: discount.value, currency_code: discount.currency_code ?? "" })
}

export const GROUP_STATUS_LABEL: Record<PublicGroupBuyGroup["status"], string> = {
  open: "กำลังรวมกลุ่ม",
  succeeded: "กลุ่มครบเป้าหมายแล้ว",
  failed: "กลุ่มไม่ครบเป้าหมาย",
}

/** ลิงก์แชร์ — middleware เติม country ให้ `/g/<token>` เอง (กฎข้อ 29b) */
export const groupSharePath = (token: string) => `/g/${encodeURIComponent(token)}`

/** GB-7a2 (กฎข้อ 29e): ปุ่ม join และลิงก์แชร์ — กลุ่ม `open` และยังไม่เลย `ends_at` (job อาจยังไม่ตัดสินกลุ่มที่หมดเวลา) */
export const groupJoinable = (group: Pick<PublicGroupBuyGroup, "status" | "ends_at">, now: number) =>
  group.status === "open" && !!group.ends_at && Date.parse(group.ends_at) > now

/** GB-7a2 (กฎข้อ 31): รายการ `group-selection` — state ในหน้า (Q20ก) แต่ละรายการคือ 1 line ของ cart ใหม่ */
export type GroupSelectionItem = { variant_id: string; quantity: number }

/** variant เดิมซ้ำ = รวมจำนวน (ไม่เกินจำนวนสูงสุดต่อ line) */
export const addToSelection = (list: GroupSelectionItem[], variantId: string, quantity: number): GroupSelectionItem[] =>
  list.some((i) => i.variant_id === variantId)
    ? list.map((i) =>
        i.variant_id === variantId ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_LINE_ITEM_QUANTITY) } : i
      )
    : [...list, { variant_id: variantId, quantity }]

export const setSelectionQuantity = (list: GroupSelectionItem[], variantId: string, raw: string): GroupSelectionItem[] =>
  list.map((i) => (i.variant_id === variantId ? { ...i, quantity: clampLineItemQuantity(raw) } : i))

export const removeFromSelection = (list: GroupSelectionItem[], variantId: string) =>
  list.filter((i) => i.variant_id !== variantId)

/** จำนวนชิ้นรวมทุก variant (`max_units_per_person` นับรวม — Q20ค) */
export const selectionUnits = (list: GroupSelectionItem[]) => list.reduce((sum, i) => sum + i.quantity, 0)
