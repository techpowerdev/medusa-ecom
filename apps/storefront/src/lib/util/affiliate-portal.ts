// AF-8a (spec 05): logic ล้วนของ portal affiliate — การ์ดสินค้า (กฎ 29) และแท็บ

export type PortalTab = "active" | "upcoming"

type VariantPrice = {
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
}

/** `?tab=` → แท็บของหน้า Products (ค่าอื่น = active) */
export const portalTab = (value: string | string[] | undefined): PortalTab =>
  value === "upcoming" ? "upcoming" : "active"

/** `?page=` → เลขหน้าจำนวนเต็ม ≥ 1 (API รับเฉพาะ int; ทศนิยมปัดลง ค่าอื่น/ใหญ่เกินกลับหน้า 1 — qa #135 D2) */
export const portalPage = (value: string | string[] | undefined): number => {
  const page = Math.floor(Number(value))
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

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

const variantPrices = (variants: VariantPrice[]) =>
  variants.flatMap(({ calculated_price: p }) =>
    p && typeof p.calculated_amount === "number" && p.currency_code
      ? [{ amount: p.calculated_amount, currency_code: p.currency_code }]
      : []
  )

/** ราคาบนการ์ด = ราคาต่ำสุดของ variant ที่อยู่ในโปรแกรม (API ส่งเฉพาะ variant ที่โปรแกรมคลุม) */
export const cardPrice = (variants: VariantPrice[]): { amount: number; currency_code: string } | null =>
  variantPrices(variants).reduce<{ amount: number; currency_code: string } | null>(
    (min, p) => (!min || p.amount < min.amount ? p : min),
    null
  )

/** AF-8c กฎ 35a: variant ในโปรแกรมมีราคาต่างกัน → ยอดประมาณการขึ้นต้น "ตั้งแต่" */
export const priceVaries = (variants: VariantPrice[]): boolean =>
  new Set(variantPrices(variants).map((p) => p.amount)).size > 1

const HOUR = 60 * 60 * 1000

/**
 * AF-8c กฎ 36a: นับถอยหลังของแท็บ upcoming — ≥ 24 ชม. → วัน (ปัดลง); < 24 ชม. → ชั่วโมง (ปัดขึ้น);
 * < 1 ชม. → "ไม่ถึง 1 ชั่วโมง" (คิดจากช่วงเวลา ไม่ขึ้นกับ timezone ของเครื่อง)
 */
export const countdownText = (startsAt: string | Date, now: Date = new Date()): string => {
  const ms = new Date(startsAt).getTime() - now.getTime()
  if (ms <= 0) {
    return "เริ่มแล้ว"
  }
  if (ms < HOUR) {
    return "เริ่มในอีกไม่ถึง 1 ชั่วโมง"
  }
  if (ms < 24 * HOUR) {
    return `เริ่มในอีก ${Math.ceil(ms / HOUR)} ชั่วโมง`
  }
  return `เริ่มในอีก ${Math.floor(ms / (24 * HOUR))} วัน`
}

export const EARNING_STATUSES = ["pending", "approved", "paid", "reversed"] as const
export type EarningStatus = (typeof EARNING_STATUSES)[number]
type EarningsTotal = { currency: string; status: string; amount: number }
type Money = { amount: number; currency_code: string }

/**
 * AF-8b (กฎ 33): จัดแถวของ `GET /affiliate/me/earnings` (GROUP BY currency, status) ตามสถานะ — ใช้ยอดของแถวตรงๆ
 * ไม่หักลบหรือรวมยอดที่ storefront (reversed เป็นแถวติดลบแยก); สถานะที่ API ไม่คืนแถว → ฿0
 */
export const earningsByStatus = (totals: EarningsTotal[]): Record<EarningStatus, Money[]> =>
  Object.fromEntries(
    EARNING_STATUSES.map((status) => {
      const rows = totals
        .filter((t) => t.status === status)
        .map((t) => ({ amount: t.amount, currency_code: t.currency }))
      return [status, rows.length ? rows : [{ amount: 0, currency_code: "thb" }]]
    })
  ) as Record<EarningStatus, Money[]>
