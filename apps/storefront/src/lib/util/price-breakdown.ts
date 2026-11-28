// SFUI-24a (spec 01 กฎข้อ 158b–e): แยกยอดของ cart/order เป็น "รวมค่าสินค้า / ค่าจัดส่ง / ส่วนลด (โค้ด) / ภาษีมูลค่าเพิ่ม"
// ทีละรายการในฐานของรายการนั้น ด้วยสูตรเดียวกับ `calculateAdjustmentTotal` ของ `@medusajs/utils` 2.22.1
// (`dist/totals/adjustment/index.js:18–24`) — "ยอดรวมทั้งสิ้น" ใช้ `total` ของ Medusa เสมอ
// storefront ไม่มี MathBN: คำนวณด้วย Number เพื่อ**แสดงผลเท่านั้น** (ปัดครั้งเดียวตอนแสดง) ไม่ส่งตัวเลขกลับ backend (กฎข้อ 158e)

/** prefix ของโค้ดซื้อกลุ่มที่ workflow ใส่ให้ — ค่าเดียวกับ `apps/backend/src/lib/promotion-exclusivity.ts` (ADR-011) */
export const GROUP_BUY_CODE_PREFIX = "GB-"

type Amount = number | null | undefined

type Adjustment = { code?: string | null; amount?: Amount; is_tax_inclusive?: boolean | null }

type Priced = {
  is_tax_inclusive?: boolean | null
  tax_total?: Amount
  tax_lines?: { rate?: Amount }[] | null
  adjustments?: Adjustment[] | null
}

export type PricedLine = Priced & { unit_price?: Amount; quantity?: Amount }

export type PricedShippingMethod = Priced & { amount?: Amount }

export type PricedPromotion = { code?: string | null; is_automatic?: boolean | null }

export type PricedDocument = {
  total?: Amount
  items?: PricedLine[] | null
  shipping_methods?: PricedShippingMethod[] | null
  promotions?: PricedPromotion[] | null
}

export type PriceBreakdown = {
  /** รวมค่าสินค้า = Σ ยอดของ line หลังส่วนลดอัตโนมัติ */
  subtotal: number
  /** ค่าจัดส่ง = Σ ยอดของ shipping method หลังส่วนลดอัตโนมัติ */
  shipping: number
  /** ส่วนลดจากโค้ดที่ลูกค้าใส่เอง (บวก) */
  discount: number
  /** ภาษีที่ต้องบวกเพิ่ม = Σ tax_total ของรายการที่ไม่รวม VAT */
  tax: number
  /** `total` ของ Medusa */
  total: number
  /** โค้ดที่ลูกค้าใส่ซึ่งมีผลกับยอด (ลำดับที่พบ ไม่ซ้ำ) */
  codes: string[]
  /** rate (%) ของรายการที่ไม่รวม VAT ถ้ามีค่าเดียว ไม่งั้น null */
  taxRate: number | null
  /** มี shipping method ที่ราคาไม่เป็น 0 (ค่าส่งเก็บจริงก่อนส่วนลด) */
  hasShippingCharge: boolean
}

const num = (value: Amount) => Number(value ?? 0)

const rateOf = (priced: Priced) => (priced.tax_lines ?? []).reduce((sum, line) => sum + num(line.rate), 0)

/**
 * กฎข้อ 158b: โค้ดที่ลูกค้าใส่เอง — ขึ้นต้น `GB-` เป็นอัตโนมัติเสมอ (workflow ซื้อกลุ่มใส่ให้);
 * code ที่ไม่พบใน promotions (เช่น promotion ถูกลบ) นับเป็นโค้ดเพื่อไม่ซ่อนเงิน; นอกนั้นตาม `is_automatic`
 */
export function isCustomerCode(code: string | null | undefined, promotions: PricedPromotion[] | null | undefined) {
  if (code?.startsWith(GROUP_BUY_CODE_PREFIX)) return false
  const promotion = (promotions ?? []).find((p) => !!code && p.code === code)
  return promotion ? promotion.is_automatic === false : true
}

/** adjustment บนฐานของรายการ: s = adj รวม VAT ? amount ÷ (1 + r) : amount แล้ว × (1 + r) ถ้ารายการรวม VAT */
function adjustmentOnBase(adjustment: Adjustment, priced: Priced) {
  const r = rateOf(priced) / 100
  const s = adjustment.is_tax_inclusive ? num(adjustment.amount) / (1 + r) : num(adjustment.amount)
  return priced.is_tax_inclusive ? s * (1 + r) : s
}

function splitAdjustments(priced: Priced, promotions: PricedPromotion[] | null | undefined) {
  let automatic = 0
  let code = 0
  const codes: string[] = []
  for (const adjustment of priced.adjustments ?? []) {
    const amount = adjustmentOnBase(adjustment, priced)
    if (isCustomerCode(adjustment.code, promotions)) {
      code += amount
      if (adjustment.code) codes.push(adjustment.code)
    } else {
      automatic += amount
    }
  }
  return { automatic, code, codes }
}

/** ยอดของ line ในฐานของ line = unit_price × quantity − Σ ส่วนลดอัตโนมัติ (กฎข้อ 158c) */
export function lineAmount(item: PricedLine, promotions: PricedPromotion[] | null | undefined) {
  return num(item.unit_price) * num(item.quantity) - splitAdjustments(item, promotions).automatic
}

/** SFUI-24c (กฎข้อ 159a): ราคาต่อชิ้นของแถว = ยอดของ line ÷ quantity (ส่วนลดจากโค้ดไม่ลดราคาในแถว) */
export function lineUnitPrice(item: PricedLine, promotions: PricedPromotion[] | null | undefined) {
  const quantity = num(item.quantity)
  return quantity ? lineAmount(item, promotions) / quantity : 0
}

/** SFUI-24c (กฎข้อ 159b): ราคาอ้างอิงก่อนลด = compare_at_unit_price ของ price list แบบ sale ถ้าสูงกว่า unit_price ไม่งั้น unit_price */
export function lineReferenceUnitPrice(item: PricedLine & { compare_at_unit_price?: Amount }) {
  const unit = num(item.unit_price)
  const compareAt = num(item.compare_at_unit_price)
  return compareAt > unit + 0.005 ? compareAt : unit
}

export function priceBreakdown(doc: PricedDocument): PriceBreakdown {
  const { promotions } = doc
  const codes = new Set<string>()
  const rates = new Set<number>()
  let subtotal = 0
  let shipping = 0
  let discount = 0
  let tax = 0

  const add = (priced: Priced, gross: number) => {
    const split = splitAdjustments(priced, promotions)
    split.codes.forEach((code) => codes.add(code))
    discount += split.code
    if (priced.is_tax_inclusive === false) {
      tax += num(priced.tax_total)
      if (rateOf(priced) > 0) rates.add(rateOf(priced))
    }
    return gross - split.automatic
  }

  for (const item of doc.items ?? []) subtotal += add(item, num(item.unit_price) * num(item.quantity))
  for (const method of doc.shipping_methods ?? []) shipping += add(method, num(method.amount))

  return {
    subtotal,
    shipping,
    discount,
    tax,
    total: num(doc.total),
    codes: Array.from(codes),
    taxRate: rates.size === 1 ? Array.from(rates)[0] : null,
    hasShippingCharge: (doc.shipping_methods ?? []).some((method) => num(method.amount) > 0.005),
  }
}
