// FS-6 (spec 03 กฎข้อ 4, AC-4, AC-8 g, AC-13 e): logic ของ UI flash sale — pure
// ข้อมูลมาจาก `GET /store/flash-sales/active` (FS-4/FS-7); ราคาคำนวณโดย Promotion module ของ Medusa ไม่คำนวณเอง (กฎข้อ 2)

export type FlashSale = {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  banner_text: string | null
  show_countdown: boolean
  show_remaining: boolean
  sold_out: boolean
  remaining_units: number | null
}

export type FlashVariantPrice = {
  variant_id: string
  currency_code: string
  original_price: number
  flash_price: number | null
  campaign_id: string | null
}

export type ActiveFlashSales = {
  flash_sales: FlashSale[]
  variants: FlashVariantPrice[]
}

export type FlashOffer = { sale: FlashSale; price: FlashVariantPrice }

const endsAtMs = (endsAt: string | null) =>
  endsAt ? new Date(endsAt).getTime() : Infinity

/** แคมเปญ + ราคา flash ของ variant; null เมื่อ variant ไม่อยู่ในแคมเปญหรือเลย `ends_at` ตามนาฬิกาของ browser แล้ว */
export function flashOfferForVariant(
  data: ActiveFlashSales | null,
  variantId: string | undefined,
  now: number
): FlashOffer | null {
  const price = data?.variants.find((v) => v.variant_id === variantId)
  if (!price?.campaign_id || price.flash_price == null) {
    return null
  }
  const sale = data!.flash_sales.find((s) => s.id === price.campaign_id)
  if (!sale || endsAtMs(sale.ends_at) <= now) {
    return null
  }
  return { sale, price }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** เวลาที่เหลือก่อน `ends_at` เป็น "HH:MM:SS" หรือ "N วัน HH:MM:SS"; null เมื่อหมดเวลาหรือไม่มี `ends_at` */
export function countdownLabel(
  endsAt: string | null,
  now: number
): string | null {
  const left = Math.floor((endsAtMs(endsAt) - now) / 1000)
  if (!Number.isFinite(left) || left <= 0) {
    return null
  }
  const days = Math.floor(left / 86_400)
  const time = `${pad(Math.floor((left % 86_400) / 3600))}:${pad(
    Math.floor((left % 3600) / 60)
  )}:${pad(left % 60)}`
  return days ? `${days} วัน ${time}` : time
}

/**
 * AC-8 (g), ADR-009 "code ชนะ": cart มี promotion code (`is_automatic=false`) และมีสินค้าที่อยู่ในแคมเปญ flash
 * → Medusa ไม่ใส่ส่วนลด flash ให้ cart นี้ ต้องบอกลูกค้า
 */
export function hasFlashCodeConflict(
  promotions: { is_automatic?: boolean | null }[] | null | undefined,
  data: ActiveFlashSales | null
): boolean {
  const hasCode = (promotions ?? []).some((p) => p.is_automatic === false)
  return (
    hasCode &&
    !!data?.variants.some((v) => v.campaign_id && v.flash_price != null)
  )
}
