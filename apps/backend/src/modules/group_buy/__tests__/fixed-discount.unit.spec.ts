import { MedusaError } from "@medusajs/framework/utils"
import { assertFixedDiscountBelowPrice, lowestBasePrice, type VariantPrice } from "../utils/fixed-discount"

const thb = (amount: number | string, price_list_id: string | null = null): VariantPrice => ({
  amount,
  currency_code: "thb",
  price_list_id,
})

// spec 04 กฎข้อ 41a, AC-61d: ราคาฐานต่ำสุดของทุก variant ในสกุลของส่วนลด
describe("lowestBasePrice", () => {
  it("ไม่มีราคา → null", () => {
    expect(lowestBasePrice([], "thb")).toBeNull()
    expect(lowestBasePrice(null, "thb")).toBeNull()
  })

  it("ไม่มีราคาฐานในสกุลนั้น → null", () => {
    expect(lowestBasePrice([{ amount: 20, currency_code: "usd", price_list_id: null }], "thb")).toBeNull()
  })

  it("กรองสกุลเงินแบบไม่สนตัวพิมพ์ และคืนราคาต่ำสุด", () => {
    const prices = [thb(1000), { amount: 500, currency_code: "THB", price_list_id: null }, { amount: 20, currency_code: "usd", price_list_id: null }]
    expect(lowestBasePrice(prices, "THB")?.toString()).toEqual("500")
    expect(lowestBasePrice(prices, "usd")?.toString()).toEqual("20")
  })

  it("ข้ามราคาที่มี price_list_id (เช่น sale)", () => {
    expect(lowestBasePrice([thb(1000), thb(100, "plist_sale")], "thb")?.toString()).toEqual("1000")
    expect(lowestBasePrice([thb(100, "plist_sale")], "thb")).toBeNull()
  })

  it("ข้ามรายการที่เป็น null และไม่มี amount", () => {
    expect(lowestBasePrice([null, { currency_code: "thb", price_list_id: null }, thb(700)], "thb")?.toString()).toEqual("700")
  })
})

describe("assertFixedDiscountBelowPrice", () => {
  const prices = [thb(1000), thb("499.99"), thb(100, "plist_sale"), { amount: 20, currency_code: "usd", price_list_id: null }]
  const fixed = (value: number, currency_code?: string, allocation: "each" | "across" = "each") => ({
    type: "fixed" as const,
    value,
    currency_code,
    allocation,
  })
  const errorOf = (fn: () => void): MedusaError | undefined => {
    try {
      fn()
    } catch (e) {
      return e as MedusaError
    }
    return undefined
  }

  it("ทศนิยมเทียบด้วย MathBN: 499.98 ผ่าน, 499.99 และ 500 ไม่ผ่าน", () => {
    expect(() => assertFixedDiscountBelowPrice(fixed(499.98, "thb"), prices)).not.toThrow()
    for (const value of [499.99, 500]) {
      const error = errorOf(() => assertFixedDiscountBelowPrice(fixed(value, "thb"), prices))
      expect(error).toBeInstanceOf(MedusaError)
      expect(error!.type).toEqual(MedusaError.Types.INVALID_DATA)
      expect(error!.message).toContain("lowest variant price")
      expect(error!.message).toContain(String(value))
      expect(error!.message).toContain("499.99")
      expect(error!.message).toContain("THB")
    }
  })

  it("กรองสกุลเงินไม่สนตัวพิมพ์ (USD 20)", () => {
    expect(() => assertFixedDiscountBelowPrice(fixed(19, "USD"), prices)).not.toThrow()
    expect(errorOf(() => assertFixedDiscountBelowPrice(fixed(20, "USD"), prices))).toBeInstanceOf(MedusaError)
  })

  // ตั้งใจ (review #411): allocation "across" เทียบกับราคาต่อหน่วยเหมือน "each" — เข้มกว่าจำเป็นแต่ตรงกฎข้อ 41
  it("allocation across เทียบกับราคาต่อหน่วยเช่นเดียวกับ each", () => {
    expect(errorOf(() => assertFixedDiscountBelowPrice(fixed(500, "thb", "across"), prices))).toBeInstanceOf(MedusaError)
    expect(() => assertFixedDiscountBelowPrice(fixed(499.98, "thb", "across"), prices)).not.toThrow()
  })

  it.each([
    ["percentage", { type: "percentage" as const, value: 100, currency_code: "thb" }],
    ["fixed ที่ไม่มี currency_code", fixed(5000)],
    ["fixed ในสกุลที่ไม่มีราคาฐาน", fixed(5000, "eur")],
  ])("ไม่ตรวจ: %s", (_, method) => {
    expect(() => assertFixedDiscountBelowPrice(method, prices)).not.toThrow()
  })
})
