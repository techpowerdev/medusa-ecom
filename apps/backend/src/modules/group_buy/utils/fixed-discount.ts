import { MathBN, MedusaError } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"

type Decimal = ReturnType<typeof MathBN.convert>

// รูปที่อ่านผ่าน Query: product.variants.prices (Query typing ให้ทุก field เป็น nullable)
export type VariantPrice = {
  amount?: BigNumberInput | null
  currency_code?: string | null
  price_list_id?: string | null
}

export type DiscountMethod = {
  type?: string | null
  value?: BigNumberInput | null
  currency_code?: string | null
}

/** spec 04 กฎข้อ 41a: ราคาฐานต่ำสุด (price_list_id เป็น null) ในสกุล currencyCode (ไม่สนตัวพิมพ์); ไม่มี → null */
export function lowestBasePrice(
  prices: (VariantPrice | null | undefined)[] | null | undefined,
  currencyCode: string
): Decimal | null {
  const currency = currencyCode.toLowerCase()
  let lowest: Decimal | null = null
  for (const price of prices ?? []) {
    if (
      !price ||
      price.price_list_id ||
      price.amount === null ||
      price.amount === undefined ||
      price.currency_code?.toLowerCase() !== currency
    ) {
      continue
    }
    if (lowest === null || MathBN.lt(price.amount, lowest)) {
      lowest = MathBN.convert(price.amount)
    }
  }
  return lowest
}

/**
 * spec 04 กฎข้อ 41b–c: fixed ที่มี currency_code และ value ≥ ราคาฐานต่ำสุด → INVALID_DATA (400)
 * ไม่ตรวจ percentage, fixed ที่ไม่มี currency_code และสกุลที่ไม่มีราคาฐาน
 * ตั้งใจ (review #411): allocation "across" เทียบกับราคาต่อหน่วยเช่นเดียวกับ "each" — เข้มกว่าจำเป็นสำหรับ across แต่ตรงกฎข้อ 41
 */
export function assertFixedDiscountBelowPrice(
  method: DiscountMethod,
  prices: (VariantPrice | null | undefined)[] | null | undefined
): void {
  if (method.type !== "fixed" || !method.currency_code || method.value === null || method.value === undefined) {
    return
  }
  const minPrice = lowestBasePrice(prices, method.currency_code)
  if (minPrice === null || MathBN.lt(method.value, minPrice)) {
    return
  }
  const currency = method.currency_code.toUpperCase()
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Fixed discount ${MathBN.convert(method.value).toString()} ${currency} must be lower than the lowest variant price ${minPrice.toString()} ${currency}`
  )
}
