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
}

export type CampaignBudgetLike = {
  type?: string | null
  limit?: BigNumberInput | null
  used?: BigNumberInput | null
} | null

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
 * amount ของ action เป็นฐานไม่รวมภาษี (ฐาน `subtotal`) จึงแปลงเป็นฐานเดียวกับ `price` ด้วย `price / subtotal`
 */
export function flashPriceFromActions(
  { price, subtotal }: { price: BigNumberInput; subtotal: BigNumberInput },
  actions: ComputedActionLike[],
  flashCodes: Set<string>
): number | null {
  const flashAdjustments = actions.filter(
    (a) => a.action === "addItemAdjustment" && flashCodes.has(a.code) && a.amount != null
  )
  if (!flashAdjustments.length) {
    return null
  }
  const discount = flashAdjustments.reduce(
    (sum, a) => MathBN.add(sum, a.amount as BigNumberInput),
    MathBN.convert(0)
  )
  const ratio = MathBN.gt(subtotal, 0) ? MathBN.div(price, subtotal) : MathBN.convert(1)
  return MathBN.max(MathBN.sub(price, MathBN.mult(discount, ratio)), 0).toNumber()
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

/** หน่วยที่เหลือของ campaign budget แบบ `usage` (spec 03 กฎข้อ 4); null เมื่อไม่มี budget usage หรือไม่ตั้ง limit */
export function remainingUsage(budget: CampaignBudgetLike): number | null {
  if (budget?.type !== "usage" || budget.limit == null) {
    return null
  }
  return MathBN.max(MathBN.sub(budget.limit, budget.used ?? 0), 0).toNumber()
}
