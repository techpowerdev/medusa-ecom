import { BigNumber } from "@medusajs/framework/utils"
import {
  flashPreviewContext,
  flashPriceFromActions,
  flashSaleAvailability,
  mapWithConcurrency,
} from "../flash-sale-preview"

// FS-4 (spec 03 "API", AC-4): price preview ของ flash sale — Medusa คำนวณส่วนลด เราแค่รวม adjustment ของ flash promotion

describe("flashPreviewContext", () => {
  const variant = {
    id: "variant_1",
    product_id: "prod_1",
    product: { id: "prod_1", collection_id: "pcol_1", categories: [{ id: "pcat_1" }] },
  }
  const base = { currency_code: "thb", region_id: "reg_1", variant, subtotal: 500, original_total: 535 }

  it('always sends exclusivity.code_applied = "false" so exclusive flash promotions survive the prefilter (rule 6g)', () => {
    expect(flashPreviewContext(base).exclusivity).toEqual({ code_applied: "false" })
  })

  it("builds one synthetic discountable line of quantity 1 with tax-exclusive subtotal and tax-inclusive original_total (like a cart line)", () => {
    const context = flashPreviewContext(base)
    expect(context.currency_code).toBe("thb")
    expect(context.region_id).toBe("reg_1")
    expect(context.region).toEqual({ id: "reg_1" })
    expect(context.items).toEqual([
      expect.objectContaining({
        variant_id: "variant_1",
        product_id: "prod_1",
        product: variant.product,
        quantity: 1,
        subtotal: 500,
        original_total: 535,
        is_discountable: true,
      }),
    ])
  })
})

describe("flashPriceFromActions", () => {
  const flashCodes = new Set(["FLASH20"])

  it("returns null when no flash promotion adjusts the line", () => {
    expect(flashPriceFromActions({ price: 500, subtotal: 500, original_total: 500 }, [], flashCodes)).toBeNull()
    expect(
      flashPriceFromActions(
        { price: 500, subtotal: 500, original_total: 500 },
        [{ action: "addItemAdjustment", code: "OTHER", item_id: "i", amount: 50 }],
        flashCodes
      )
    ).toBeNull()
  })

  it("subtracts the amounts of flash item adjustments only (BigNumber or number)", () => {
    expect(
      flashPriceFromActions(
        { price: 500, subtotal: 500, original_total: 500 },
        [
          { action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: new BigNumber(100) },
          { action: "addItemAdjustment", code: "OTHER", item_id: "i", amount: 30 },
          { action: "campaignBudgetExceeded", code: "FLASH20" },
        ],
        flashCodes
      )
    ).toBe(400)
  })

  it("converts tax-exclusive adjustment amounts to the price basis (tax-inclusive price: 100 excl. VAT 7% = 107)", () => {
    expect(
      flashPriceFromActions(
        { price: 535, subtotal: 500, original_total: 535 },
        [{ action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 100 }],
        flashCodes
      )
    ).toBeCloseTo(428, 6)
  })

  it("does not add tax twice for tax-inclusive promotions (amount already on the original_total basis)", () => {
    // 535 รวม VAT ลด 20% แบบ tax-inclusive: Medusa คืน amount = 107 (ฐานรวมภาษี) → cart = 428
    expect(
      flashPriceFromActions(
        { price: 535, subtotal: 500, original_total: 535 },
        [{ action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 107, is_tax_inclusive: true }],
        flashCodes
      )
    ).toBeCloseTo(428, 6)
  })

  it("converts each adjustment by its own basis when tax-inclusive and tax-exclusive promotions mix", () => {
    expect(
      flashPriceFromActions(
        { price: 535, subtotal: 500, original_total: 535 },
        [
          { action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 107, is_tax_inclusive: true },
          { action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 100, is_tax_inclusive: false },
        ],
        flashCodes
      )
    ).toBeCloseTo(321, 6)
  })

  it("keeps a tax-exclusive price basis when the price itself excludes tax", () => {
    // ราคา 500 ไม่รวม VAT (original_total 535): promotion tax-inclusive amount 107 → ฐานราคา 100
    expect(
      flashPriceFromActions(
        { price: 500, subtotal: 500, original_total: 535 },
        [{ action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 107, is_tax_inclusive: true }],
        flashCodes
      )
    ).toBeCloseTo(400, 6)
  })

  it("never goes below zero", () => {
    expect(
      flashPriceFromActions(
        { price: 100, subtotal: 100, original_total: 100 },
        [{ action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 150 }],
        flashCodes
      )
    ).toBe(0)
  })
})

describe("mapWithConcurrency", () => {
  it("keeps input order and never runs more than `limit` tasks at once", async () => {
    let running = 0
    let peak = 0
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5 * (n % 3)))
      running -= 1
      return n * 10
    })

    expect(peak).toBe(5)
    expect(result).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120])
  })

  it("runs sequentially when limit is 1 and handles empty input", async () => {
    let running = 0
    let peak = 0
    await mapWithConcurrency([1, 2, 3], 1, async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 1))
      running -= 1
    })
    expect(peak).toBe(1)
    expect(await mapWithConcurrency([], 5, async (n: number) => n)).toEqual([])
  })
})

// FS-7 (spec 03 กฎข้อ 4, AC-13 a–d): นับจากหน่วยใน FlashSaleConfig ไม่ใช่ campaign budget
describe("flashSaleAvailability", () => {
  const cfg = (total_cap: number | null, units_sold: number, show_remaining = true) => ({
    total_cap,
    units_sold,
    show_remaining,
  })

  it("is total_cap - units_sold while units remain (AC-13 a)", () => {
    expect(flashSaleAvailability(cfg(10, 7))).toEqual({ sold_out: false, remaining_units: 3 })
  })

  it("is sold out with 0 remaining when units_sold reaches total_cap (AC-13 b)", () => {
    expect(flashSaleAvailability(cfg(10, 10))).toEqual({ sold_out: true, remaining_units: 0 })
  })

  it("clamps remaining_units at 0 when total_cap was lowered below units_sold (AC-13 c)", () => {
    expect(flashSaleAvailability(cfg(5, 10))).toEqual({ sold_out: true, remaining_units: 0 })
  })

  it("hides remaining_units but still reports sold_out when show_remaining=false (AC-13 d)", () => {
    expect(flashSaleAvailability(cfg(10, 10, false))).toEqual({ sold_out: true, remaining_units: null })
    expect(flashSaleAvailability(cfg(10, 3, false))).toEqual({ sold_out: false, remaining_units: null })
  })

  it("is never sold out and has no remaining_units without total_cap (AC-13 d)", () => {
    expect(flashSaleAvailability(cfg(null, 10))).toEqual({ sold_out: false, remaining_units: null })
    expect(flashSaleAvailability(cfg(null, 0, false))).toEqual({ sold_out: false, remaining_units: null })
  })
})
