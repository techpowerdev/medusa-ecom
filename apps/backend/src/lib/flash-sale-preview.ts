// FS-4 (spec 03 "API", AC-4): price preview ของ flash sale — pure
// Medusa (Promotion module `computeActions`) เป็นผู้คำนวณส่วนลด เราแค่สร้าง line สังเคราะห์และรวม adjustment (ADR-003)
import { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"
import { exclusivityPromotionContext } from "./promotion-exclusivity"

export type PreviewVariant = {
  id: string
  product_id?: string | null
  product?: Record<string, unknown> | null
}

export type ComputedActionLike = {
  action: string
  code: string
  item_id?: string
  amount?: BigNumberInput
  is_tax_inclusive?: boolean
}

/**
 * context ของ `computeActions` สำหรับ variant หนึ่งตัว: line สังเคราะห์ quantity 1 แบบเดียวกับ cart line
 * (`subtotal` = ราคาไม่รวมภาษี, `original_total` = ราคารวมภาษี) เพื่อให้ promotion แบบ fixed ที่ไม่ tax-inclusive ตรงกับ cart
 * ต้องส่ง `exclusivity.code_applied: "false"` เสมอ (กฎข้อ 6g) — ไม่เช่นนั้น prefilter ของ Medusa ตัด
 * flash promotion ที่มี exclusivity rule ทิ้ง (preview = cart ที่ไม่มี code)
 */
export function flashPreviewContext({
  currency_code,
  region_id,
  variant,
  subtotal,
  original_total,
}: {
  currency_code: string
  region_id: string
  variant: PreviewVariant
  subtotal: BigNumberInput
  original_total: BigNumberInput
}) {
  return {
    currency_code,
    region_id,
    region: { id: region_id },
    ...exclusivityPromotionContext(false),
    items: [
      {
        id: `preview_${variant.id}`,
        variant_id: variant.id,
        product_id: variant.product_id ?? undefined,
        product: variant.product ?? undefined,
        quantity: 1,
        subtotal,
        original_total,
        is_discountable: true,
      },
    ],
  }
}

/**
 * ราคาหลังหัก adjustment ของ flash promotion (`flashCodes`); null เมื่อไม่มี flash promotion ใดลด line นี้
 * amount ของ action อยู่บนฐานตาม `is_tax_inclusive` ของ promotion (`calculateAdjustmentAmountFromPromotion`):
 * tax-inclusive → ฐาน `original_total` (รวมภาษี), ไม่ใช่ → ฐาน `subtotal` (ไม่รวมภาษี)
 * จึงแปลงทีละ adjustment เป็นฐานเดียวกับ `price` ด้วย `price / ฐานของมัน`
 */
export function flashPriceFromActions(
  {
    price,
    subtotal,
    original_total,
  }: { price: BigNumberInput; subtotal: BigNumberInput; original_total: BigNumberInput },
  actions: ComputedActionLike[],
  flashCodes: Set<string>
): number | null {
  const flashAdjustments = actions.filter(
    (a) => a.action === "addItemAdjustment" && flashCodes.has(a.code) && a.amount != null
  )
  if (!flashAdjustments.length) {
    return null
  }
  const toPriceBasis = (a: ComputedActionLike) => {
    const base = a.is_tax_inclusive ? original_total : subtotal
    const ratio = MathBN.gt(base, 0) ? MathBN.div(price, base) : MathBN.convert(1)
    return MathBN.mult(a.amount as BigNumberInput, ratio)
  }
  const discount = flashAdjustments.reduce(
    (sum, a) => MathBN.add(sum, toPriceBasis(a)),
    MathBN.convert(0)
  )
  return MathBN.max(MathBN.sub(price, discount), 0).toNumber()
}

/** map แบบจำกัดจำนวนงานพร้อมกัน (คงลำดับผลลัพธ์) — กัน route สาธารณะใช้ DB pool จนหมด */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export type FlashSaleAvailability = {
  sold_out: boolean
  remaining_units: number | null
}

/**
 * FS-7 (spec 03 กฎข้อ 4, AC-13): สถานะคงเหลือจากตัวนับหน่วยเดียวกับที่ FS-3 ใช้ตัดสิน total cap
 * ห้ามใช้ campaign budget `usage` ของ Medusa เพราะนับต่อ order ไม่ใช่ต่อหน่วย
 * - `sold_out` = มี `total_cap` และ `units_sold >= total_cap` (ไม่ขึ้นกับ `show_remaining`)
 * - `remaining_units` = `max(0, total_cap - units_sold)` เมื่อ `show_remaining` และมี `total_cap`, มิฉะนั้น null
 */
export function flashSaleAvailability({
  total_cap,
  units_sold,
  show_remaining,
}: {
  total_cap: number | null
  units_sold: number
  show_remaining: boolean
}): FlashSaleAvailability {
  if (total_cap == null) {
    return { sold_out: false, remaining_units: null }
  }
  return {
    sold_out: units_sold >= total_cap,
    remaining_units: show_remaining ? Math.max(0, total_cap - units_sold) : null,
  }
}
