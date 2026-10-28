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

/**
 * FS-13 (กฎข้อ 18): ราคา flash บนการ์ดสินค้า PLP — variant ที่ราคา flash ต่ำสุดของสินค้า; null เมื่อไม่มี variant ในแคมเปญที่ยังขายได้
 * (แคมเปญ sold_out แล้วการ์ดแสดงราคาปกติ ลูกค้าเห็น "สินค้าหมด" บน PDP)
 */
export function cardFlashOffer(
  data: ActiveFlashSales | null,
  variantIds: string[],
  now: number
): FlashOffer | null {
  return variantIds.reduce<FlashOffer | null>((best, id) => {
    const offer = flashOfferForVariant(data, id, now)
    if (!offer || offer.sale.sold_out) {
      return best
    }
    return !best || offer.price.flash_price! < best.price.flash_price!
      ? offer
      : best
  }, null)
}

/** FS-13/FS-14: ราคา flash ต่อสินค้าของการ์ด (key = product id; ไม่มี key = แสดงราคาปกติ) */
export function cardFlashPrices(
  data: ActiveFlashSales | null,
  variantIdsByProduct: Record<string, string[]>,
  now: number
): Record<string, FlashVariantPrice> {
  const prices: Record<string, FlashVariantPrice> = {}
  for (const [productId, variantIds] of Object.entries(variantIdsByProduct)) {
    const offer = cardFlashOffer(data, variantIds, now)
    if (offer) {
      prices[productId] = offer.price
    }
  }
  return prices
}

/**
 * FS-15 (กฎข้อ 20a): จำนวนที่เลือกบน PDP เกินโควตาที่เหลือของแคมเปญ → คืน `remaining_units` (ไว้แสดงในข้อความ), ไม่เกิน → null
 * units นับเต็มจำนวน (กฎข้อ 9) จึงเกินแล้ว complete ล้มแน่นอน; `remaining_units = null` (ไม่รู้ยอด) และแคมเปญ sold out
 * (FS-13 แสดง `flash-sold-out` และ disable ปุ่มอยู่แล้ว) → null
 */
export function flashQtyExceeded(
  offer: FlashOffer | null,
  quantity: number
): number | null {
  const remaining = offer?.sale.remaining_units
  if (remaining == null || offer!.sale.sold_out) {
    return null
  }
  return quantity > remaining ? remaining : null
}

type CartLineLike = {
  id: string
  variant_id?: string | null
  quantity: number
  adjustments?: { promotion_id?: string | null }[] | null
}

/**
 * FS-15 (กฎข้อ 20b): line ใน cart ที่ได้ส่วนลด flash และ `quantity > remaining_units` → { line id: remaining_units }
 * "ได้ส่วนลด flash" = variant อยู่ในแคมเปญ และ line มี adjustment ของ promotion อัตโนมัติ — store API ของ cart ไม่ให้อ่าน
 * campaign ของ adjustment; ส่วนลดจาก code (`is_automatic=false`) ไม่นับ เพราะ code ชนะ flash (ADR-009)
 */
export function cartFlashExceeded(
  items: CartLineLike[],
  promotions: { id: string; is_automatic?: boolean | null }[] | null | undefined,
  data: ActiveFlashSales | null,
  now: number
): Record<string, number> {
  const automatic = new Set(
    (promotions ?? []).filter((p) => p.is_automatic).map((p) => p.id)
  )
  const exceeded: Record<string, number> = {}
  for (const item of items) {
    const remaining = flashOfferForVariant(data, item.variant_id ?? undefined, now)
      ?.sale.remaining_units
    const discounted = (item.adjustments ?? []).some(
      (a) => !!a.promotion_id && automatic.has(a.promotion_id)
    )
    if (remaining != null && discounted && item.quantity > remaining) {
      exceeded[item.id] = remaining
    }
  }
  return exceeded
}

/** FS-13: รวมผลของ `GET /store/flash-sales/active` ที่แบ่งยิงตามเพดาน variant ต่อ request; ทุกชุดล้ม → null */
export function mergeActiveFlashSales(
  parts: (ActiveFlashSales | null)[]
): ActiveFlashSales | null {
  const ok = parts.filter((p): p is ActiveFlashSales => !!p)
  if (!ok.length) {
    return null
  }
  const sales = new Map<string, FlashSale>()
  ok.forEach((p) => p.flash_sales.forEach((s) => sales.set(s.id, s)))
  return {
    flash_sales: Array.from(sales.values()),
    variants: ok.flatMap((p) => p.variants),
  }
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
