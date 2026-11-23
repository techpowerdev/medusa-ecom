// FS-21 (spec 03 กฎข้อ 26, AC-28): จำกัดจำนวนตามสิทธิ์ flash ที่เหลือของลูกค้า — pure
// ข้อมูลจาก `GET /store/customers/me/flash-sales/allowance` (FS-20) ใช้เตือนก่อนจ่ายเท่านั้น
// ด่านจริงคือ `reserveForCart` ตอน complete (กฎข้อ 2)

import type { ActiveFlashSales, FlashOffer } from "./flash-sale"

export type FlashAllowance = {
  variant_id: string
  campaign_id: string
  per_customer_limit: number | null
  used_units: number
  remaining_for_customer: number | null
}

/**
 * variant ที่ FS-4 บอกว่าอยู่ในแคมเปญ (`campaign_id` ไม่ null) — เรียก allowance เฉพาะชุดนี้ ไม่ preview ราคาซ้ำทั้ง cart/สินค้า
 * ข้อจำกัด: แคมเปญที่มีแต่ promotion order-level ไม่อยู่ในผลของ FS-4 จึงไม่เตือน (hook ตอน complete ยังนับสิทธิ์)
 */
export function flashCampaignVariantIds(data: ActiveFlashSales | null): string[] {
  return Array.from(
    new Set((data?.variants ?? []).filter((v) => !!v.campaign_id).map((v) => v.variant_id))
  )
}

/** remaining/max = null → ไม่รู้สิทธิ์ของลูกค้า (ไม่ login) แสดงเฉพาะ limit; in_cart = จำนวนในตะกร้าที่หักแล้ว */
export type PdpCustomerLimit = {
  limit: number
  remaining: number | null
  max: number | null
  in_cart: number
}

export type FlashCartLine = { variant_id?: string | null; quantity: number }

/**
 * กฎข้อ 26a + 28c: variant ที่เลือกมีสิทธิ์ต่อคนจำกัด → สิทธิ์ที่เหลือ = max(0, remaining_for_customer − จำนวนรวมของ line
 * ในตะกร้าที่ variant อยู่ในแคมเปญเดียวกัน (campaign_id จาก allowance)) และจำนวนสูงสุด = min(สิทธิ์ที่เหลือ, remaining_units ถ้ามี)
 * กฎข้อ 28b: ไม่มี allowance ของ variant (ไม่ login) แต่แคมเปญจำกัด → { limit, remaining: null, max: null }
 * ไม่มี offer flash / ไม่จำกัดต่อคน → null (ใช้ตัวเลือกเดิม)
 */
export function pdpCustomerLimit(
  offer: FlashOffer | null,
  allowances: FlashAllowance[],
  variantId: string | undefined,
  cartLines: FlashCartLine[] = []
): PdpCustomerLimit | null {
  if (!offer) {
    return null
  }
  const a = allowances.find((x) => x.variant_id === variantId)
  if (!a) {
    const limit = offer.sale.per_customer_limit
    return limit == null ? null : { limit, remaining: null, max: null, in_cart: 0 }
  }
  if (a.remaining_for_customer == null || a.per_customer_limit == null) {
    return null
  }
  const campaignOf = new Map(allowances.map((x) => [x.variant_id, x.campaign_id]))
  const in_cart = cartLines
    .filter((l) => !!l.variant_id && campaignOf.get(l.variant_id) === a.campaign_id)
    .reduce((sum, l) => sum + l.quantity, 0)
  const remaining = Math.max(0, a.remaining_for_customer - in_cart)
  return {
    limit: a.per_customer_limit,
    remaining,
    max: Math.min(remaining, offer.sale.remaining_units ?? Infinity),
    in_cart,
  }
}

/** ตัวเลือกจำนวนบน PDP ไม่เกิน `max`; max 0 → [1] (ผู้เรียก disable ปุ่มเพิ่มลงตะกร้า) */
export function pdpQuantityOptions(options: number[], max: number | null): number[] {
  if (max == null) {
    return options
  }
  const allowed = options.filter((q) => q <= max)
  return allowed.length ? allowed : options.slice(0, 1)
}

type CartLineLike = {
  id: string
  variant_id?: string | null
  quantity: number
  adjustments?: { promotion_id?: string | null }[] | null
}

/**
 * กฎข้อ 26b: line ที่ได้ส่วนลด flash (adjustment ของ promotion อัตโนมัติ — เกณฑ์เดียวกับ FS-15) และผลรวมจำนวนของทุก line
 * ในแคมเปญเดียวกันเกิน `remaining_for_customer` → { line id: remaining_for_customer } (เตือนทุก line ของแคมเปญนั้น)
 */
export function cartCustomerLimitExceeded(
  items: CartLineLike[],
  promotions: { id: string; is_automatic?: boolean | null }[] | null | undefined,
  allowances: FlashAllowance[]
): Record<string, number> {
  const automatic = new Set((promotions ?? []).filter((p) => p.is_automatic).map((p) => p.id))
  const byCampaign = new Map<string, { remaining: number; units: number; lines: string[] }>()

  for (const item of items) {
    const a = allowances.find((x) => x.variant_id === item.variant_id)
    const discounted = (item.adjustments ?? []).some(
      (adj) => !!adj.promotion_id && automatic.has(adj.promotion_id)
    )
    if (a?.remaining_for_customer == null || !discounted) {
      continue
    }
    const group = byCampaign.get(a.campaign_id) ?? {
      remaining: a.remaining_for_customer,
      units: 0,
      lines: [],
    }
    group.units += item.quantity
    group.lines.push(item.id)
    byCampaign.set(a.campaign_id, group)
  }

  const exceeded: Record<string, number> = {}
  for (const { remaining, units, lines } of Array.from(byCampaign.values())) {
    if (units > remaining) {
      lines.forEach((id) => (exceeded[id] = remaining))
    }
  }
  return exceeded
}
