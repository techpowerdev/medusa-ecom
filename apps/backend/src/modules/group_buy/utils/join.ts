import { MedusaError } from "@medusajs/framework/utils"
import { PROMOTION_NOT_COMBINABLE, isGroupBuyCode } from "../../../lib/promotion-exclusivity"
import { STORE_RESOURCE_NOT_FOUND } from "../../../lib/store-ownership"
import {
  GB_ALREADY_IN_OTHER_GROUP,
  GB_CART_ALREADY_JOINED,
  GB_GROUP_FULL,
  GB_ITEMS_NOT_ELIGIBLE,
  GB_MAX_TOTAL_ORDERS_REACHED,
  GB_UNITS_LIMIT_EXCEEDED,
} from "../errors"
import type { GroupBuyCampaignStatus } from "./campaign-status"
import { assertCampaignInWindow } from "./group-creation"
import type { GroupBuyProgress } from "./target"

export type JoinCheck = {
  now: Date
  campaign: {
    status: GroupBuyCampaignStatus
    starts_at: Date | null
    ends_at: Date | null
    max_total_orders: number | null
    max_units_per_person: number | null
    max_people_per_group: number | null
  }
  group: { id: string; status: string; ends_at: Date; progress_people: number }
  cartUnits: number
  // code ของ promotion ที่ is_automatic=false บน cart
  cartManualCodes: string[]
  itemsEligible: boolean
  // membership ของลูกค้าในแคมเปญนี้ที่ไม่ใช่ cancelled
  customerMemberships: { group_id: string; units: number }[]
  // membership ทั้งแคมเปญที่ไม่ใช่ cancelled (ใช้เมื่อตั้ง max_total_orders)
  campaignMembershipCount: number
}

const conflict = (code: string, message: string) =>
  new MedusaError(MedusaError.Types.CONFLICT, message, code)

// spec 04 joinGroupWorkflow ขั้น 1 (ตรวจภายใต้ lock ตาม ADR-009) — ข้อจำกัดที่ไม่ผ่าน → 409 พร้อม code ของข้อนั้น
export function assertJoinAllowed(c: JoinCheck): { isNewPerson: boolean } {
  assertCampaignInWindow({
    campaignStatus: c.campaign.status,
    startsAt: c.campaign.starts_at,
    endsAt: c.campaign.ends_at,
    now: c.now,
  })
  if (c.group.status !== "open" || c.group.ends_at.getTime() <= c.now.getTime()) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The group is no longer open for joining")
  }
  if (c.cartUnits <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "The cart has no items")
  }
  // กฎข้อ 14b: cart ที่มี GB-* อยู่แล้ว = เคย join (หรือใส่ code กลุ่มเอง) — ตรวจก่อน PROMOTION_NOT_COMBINABLE
  if (c.cartManualCodes.some(isGroupBuyCode)) {
    throw conflict(GB_CART_ALREADY_JOINED, "This cart was already used to join a group")
  }
  if (c.cartManualCodes.length) {
    throw conflict(
      PROMOTION_NOT_COMBINABLE,
      "A group buy can't be combined with other promotion codes on the cart"
    )
  }
  if (c.customerMemberships.some((m) => m.group_id !== c.group.id)) {
    throw conflict(GB_ALREADY_IN_OTHER_GROUP, "You are already in another group of this campaign")
  }

  const isNewPerson = !c.customerMemberships.length
  const { max_people_per_group, max_total_orders, max_units_per_person } = c.campaign
  if (isNewPerson && max_people_per_group && c.group.progress_people >= max_people_per_group) {
    throw conflict(GB_GROUP_FULL, "The group is full")
  }
  if (max_total_orders && c.campaignMembershipCount >= max_total_orders) {
    throw conflict(GB_MAX_TOTAL_ORDERS_REACHED, "The campaign has reached its order limit")
  }
  const units = c.customerMemberships.reduce((sum, m) => sum + m.units, 0) + c.cartUnits
  if (max_units_per_person && units > max_units_per_person) {
    throw conflict(GB_UNITS_LIMIT_EXCEEDED, `At most ${max_units_per_person} units per person`)
  }
  if (!c.itemsEligible) {
    throw conflict(GB_ITEMS_NOT_ELIGIBLE, "The cart has items outside the campaign")
  }
  return { isNewPerson }
}

type RuleValue = string | { value?: string | null } | null
export type TargetRule = { attribute: string; operator: string; values: RuleValue[] }

const valueOf = (v: RuleValue) => (typeof v === "string" ? v : v?.value ?? null)

// ค่าทั้งหมดที่ path ชี้ใน item (ไล่ผ่าน array เช่น product.categories.id)
const collect = (node: unknown, path: string[]): string[] => {
  if (node === null || node === undefined) {
    return []
  }
  if (Array.isArray(node)) {
    return node.flatMap((n) => collect(n, path))
  }
  if (!path.length) {
    return [String(node)]
  }
  return collect((node as Record<string, unknown>)[path[0]], path.slice(1))
}

// target_rules ของ promotion กลุ่ม (attribute `items.<path>`) — ทุก rule ต้องผ่าน (AND) เหมือน Medusa
export function itemMatchesTargetRules(item: unknown, rules: TargetRule[]): boolean {
  return rules.every((rule) => {
    const actual = collect(item, rule.attribute.replace(/^items\./, "").split("."))
    const expected = rule.values.map(valueOf).filter((v): v is string => v !== null)
    const hit = actual.some((v) => expected.includes(v))
    switch (rule.operator) {
      case "in":
      case "eq":
        return hit
      case "ne":
      case "nin":
        return !hit
      default:
        return false
    }
  })
}

type CartAdjustment = {
  code?: string | null
  raw_amount: unknown
  promotion_id?: string | null
  description?: string | null
  is_tax_inclusive?: boolean | null
  provider_id?: string | null
}

// กฎข้อ 5: ส่วนลดมาจาก Medusa (adjustment ที่คำนวณบน cart) และ freeze ลง draft order — จับคู่ line ของ cart
// กับ item ของ order ทีละตัวตาม variant (ลำดับเดิม) ใช้ raw_amount ไม่แปลงเป็น float
export function cartAdjustmentsForOrder(
  cartItems: { variant_id: string; adjustments?: CartAdjustment[] | null }[],
  orderItems: { id: string; variant_id: string }[]
) {
  const unmatched = [...orderItems]
  return cartItems.flatMap((cartItem) => {
    const index = unmatched.findIndex((o) => o.variant_id === cartItem.variant_id)
    if (index < 0) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No draft order item for variant ${cartItem.variant_id}`
      )
    }
    const [orderItem] = unmatched.splice(index, 1)
    return (cartItem.adjustments ?? []).map((a) => ({
      item_id: orderItem.id,
      code: a.code,
      amount: a.raw_amount,
      promotion_id: a.promotion_id,
      description: a.description,
      is_tax_inclusive: a.is_tax_inclusive,
      provider_id: a.provider_id,
    }))
  })
}

// spec 04 ขั้น 4: progress_people +1 เฉพาะ membership แรกที่ไม่ใช่ cancelled ของลูกค้าในกลุ่ม
export const joinProgress = (
  p: GroupBuyProgress,
  units: number,
  isNewPerson: boolean
): GroupBuyProgress => ({
  progress_orders: p.progress_orders + 1,
  progress_units: p.progress_units + units,
  progress_people: p.progress_people + (isNewPerson ? 1 : 0),
})

// leaveGroupWorkflow (AC-7): progress_people −1 เฉพาะเมื่อไม่เหลือ membership อื่นที่ไม่ใช่ cancelled ของลูกค้าในกลุ่ม
export const leaveProgress = (
  p: GroupBuyProgress,
  units: number,
  isLastMembership: boolean
): GroupBuyProgress => ({
  progress_orders: p.progress_orders - 1,
  progress_units: p.progress_units - units,
  progress_people: p.progress_people - (isLastMembership ? 1 : 0),
})

// spec 04 กฎข้อ 13 (AC-25): ของคนอื่น/ไม่พบ → 404 ข้อความเดียวกัน (ADR-013); ออกได้เฉพาะ membership `joined` ในกลุ่ม `open`
// ที่ยังไม่หมดเวลา — `ends_at <= now` (job ยังไม่ตัดสิน) ออกไม่ได้เหมือน join เพื่อไม่ให้เปลี่ยนผลของ deadline job
// (ตีความกฎข้อ 13 โดย session หลัก 2026-10-26)
export const assertLeaveAllowed = (input: {
  now: Date
  membership: { customer_id: string; status: string } | null | undefined
  group: { status: string; ends_at: Date }
  customer_id: string
}) => {
  if (!input.membership || input.membership.customer_id !== input.customer_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, STORE_RESOURCE_NOT_FOUND)
  }
  if (
    input.membership.status !== "joined" ||
    input.group.status !== "open" ||
    input.group.ends_at.getTime() <= input.now.getTime()
  ) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This membership can no longer leave the group")
  }
}
