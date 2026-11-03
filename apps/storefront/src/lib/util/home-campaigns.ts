// GB-7c (spec 04 กฎข้อ 29a, 29g, AC-48): logic ล้วนของส่วน `home-campaigns` บนหน้าแรก — ไม่มี I/O
import type { FlashSale } from "./flash-sale"
import { groupJoinErrorMessage } from "./group-join-error"
import { groupProgress, type GroupBuyDiscount, type PublicGroupBuyCampaign, type PublicGroupBuyGroup } from "./group-page"

export type PublicPoolGroup = Omit<PublicGroupBuyGroup, "kind">

/** รายการของ `GET /store/group-buy/campaigns/active` (GB-11) — ส่วนลดจากต้นแบบ, สินค้าเดียว (กฎข้อ 28e, 30) */
export type ActiveGroupBuyCampaign = PublicGroupBuyCampaign & { pool_groups: PublicPoolGroup[] }

/** ผลของ server action สร้างทีม (รูปแบบ `ActionResult` ของ CORE-4i + ข้อความไทยจาก error map ของ GB-7a2a) */
export type CreateTeamResult =
  | { ok: true; token: string }
  | { error: "unauthorized" }
  | { error: "failed"; message: string }

const toCents = (amount: number) => Math.round(amount * 100)

/**
 * ราคาหลังส่วนลดกลุ่ม (แสดงผลเท่านั้น — ยอดจริงคำนวณโดย Promotion module ใน draft order) คิดเป็นสตางค์ (จำนวนเต็ม) ไม่ใช้ float
 * ไม่มีส่วนลด / fixed คนละสกุลเงิน / ค่า ≤ 0 → null
 */
export function groupDiscountedAmount(amount: number, currencyCode: string, discount: GroupBuyDiscount | null): number | null {
  if (!discount || !(discount.value > 0)) return null
  const cents = toCents(amount)
  if (discount.type === "percentage") {
    return Math.round((cents * (100 - Math.min(discount.value, 100))) / 100) / 100
  }
  if (discount.currency_code?.toLowerCase() !== currencyCode.toLowerCase()) return null
  return Math.max(0, cents - toCents(discount.value)) / 100
}

export const canCreateTeam = (campaign: Pick<PublicGroupBuyCampaign, "group_mode">) =>
  campaign.group_mode === "team" || campaign.group_mode === "both"

export const poolProgress = (pool: PublicPoolGroup, campaign: PublicGroupBuyCampaign) =>
  groupProgress({ ...pool, kind: "pool" }, campaign)

/** error ของ `POST /store/group-buy/groups`: 401 → ไปหน้า login; อื่นๆ → ข้อความไทยจาก helper ของ GB-7a2a */
export function teamCreateFailure(error: unknown): Exclude<CreateTeamResult, { ok: true }> {
  if ((error as { status?: unknown } | null)?.status === 401) return { error: "unauthorized" }
  return { error: "failed", message: groupJoinErrorMessage(error) }
}

export const hasHomeCampaigns = (flash: FlashSale[], groups: ActiveGroupBuyCampaign[]) =>
  flash.length > 0 || groups.length > 0
