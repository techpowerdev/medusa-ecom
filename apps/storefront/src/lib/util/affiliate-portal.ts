// AF-8a (spec 05): logic ล้วนของ portal affiliate — การ์ดสินค้า (กฎ 29) และแท็บ

export type PortalTab = "active" | "upcoming"

type VariantPrice = {
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
}

/** `?tab=` → แท็บของหน้า Products (ค่าอื่น = active) */
export const portalTab = (value: string | string[] | undefined): PortalTab =>
  value === "upcoming" ? "upcoming" : "active"

/**
 * กฎ 29d: ราคาปัจจุบัน × อัตรา% ปัด 2 ตำแหน่งแบบ half-up (กฎ 11) ไม่รวม cap
 * คิดเป็นจำนวนเต็ม (สตางค์ × อัตราคูณ 10^4) เพื่อไม่ให้ float ปัดผิด เช่น 1.15 × 50% = 0.575 → 0.58
 */
export const estimateCommission = (price: number, rate: number): number => {
  const satang = Math.round(price * 100)
  const rateScaled = Math.round(rate * 10_000)
  const scale = 100 * 10_000
  return Math.floor((satang * rateScaled + scale / 2) / scale) / 100
}

/** ราคาบนการ์ด = ราคาต่ำสุดของ variant ที่อยู่ในโปรแกรม (API ส่งเฉพาะ variant ที่โปรแกรมคลุม) */
export const cardPrice = (variants: VariantPrice[]): { amount: number; currency_code: string } | null => {
  const prices = variants.flatMap(({ calculated_price: p }) =>
    p && typeof p.calculated_amount === "number" && p.currency_code
      ? [{ amount: p.calculated_amount, currency_code: p.currency_code }]
      : []
  )
  return prices.reduce<{ amount: number; currency_code: string } | null>(
    (min, p) => (!min || p.amount < min.amount ? p : min),
    null
  )
}

/** จำนวนวันจนถึง `startsAt` ปัดขึ้น (นับถอยหลังของแท็บ upcoming); ถึงแล้ว = 0 */
export const daysUntil = (startsAt: string | Date, now: Date = new Date()): number =>
  Math.max(0, Math.ceil((new Date(startsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
