import { BigNumber } from "@medusajs/framework/utils"
import {
  flashPreviewContext,
  flashPriceFromActions,
  isCampaignRunning,
  remainingUsage,
} from "../flash-sale-preview"

// FS-4 (spec 03 "API", AC-4): price preview ของ flash sale — Medusa คำนวณส่วนลด เราแค่รวม adjustment ของ flash promotion

describe("flashPreviewContext", () => {
  const variant = {
    id: "variant_1",
    product_id: "prod_1",
    product: { id: "prod_1", collection_id: "pcol_1", categories: [{ id: "pcat_1" }] },
  }

  it('always sends exclusivity.code_applied = "false" so exclusive flash promotions survive the prefilter (rule 6g)', () => {
    const context = flashPreviewContext({ currency_code: "thb", region_id: "reg_1", variant, amount: 500 })
    expect(context.exclusivity).toEqual({ code_applied: "false" })
  })

  it("builds one synthetic discountable line of quantity 1 at the calculated price", () => {
    const context = flashPreviewContext({ currency_code: "thb", region_id: "reg_1", variant, amount: 500 })
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
        original_total: 500,
        is_discountable: true,
      }),
    ])
  })
})

describe("flashPriceFromActions", () => {
  const flashCodes = new Set(["FLASH20"])

  it("returns null when no flash promotion adjusts the line", () => {
    expect(flashPriceFromActions(500, [], flashCodes)).toBeNull()
    expect(
      flashPriceFromActions(
        500,
        [{ action: "addItemAdjustment", code: "OTHER", item_id: "i", amount: 50 }],
        flashCodes
      )
    ).toBeNull()
  })

  it("subtracts the amounts of flash item adjustments only (BigNumber or number)", () => {
    expect(
      flashPriceFromActions(
        500,
        [
          { action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: new BigNumber(100) },
          { action: "addItemAdjustment", code: "OTHER", item_id: "i", amount: 30 },
          { action: "campaignBudgetExceeded", code: "FLASH20" },
        ],
        flashCodes
      )
    ).toBe(400)
  })

  it("never goes below zero", () => {
    expect(
      flashPriceFromActions(
        100,
        [{ action: "addItemAdjustment", code: "FLASH20", item_id: "i", amount: 150 }],
        flashCodes
      )
    ).toBe(0)
  })
})

describe("isCampaignRunning", () => {
  const now = new Date("2026-10-25T05:00:00Z")

  it("is true inside [starts_at, ends_at) and for open-ended bounds", () => {
    expect(isCampaignRunning({ starts_at: "2026-10-25T04:00:00Z", ends_at: "2026-10-25T06:00:00Z" }, now)).toBe(true)
    expect(isCampaignRunning({ starts_at: now, ends_at: null }, now)).toBe(true)
    expect(isCampaignRunning({ starts_at: null, ends_at: null }, now)).toBe(true)
  })

  it("is false before starts_at or from ends_at on (matches Medusa listActivePromotions)", () => {
    expect(isCampaignRunning({ starts_at: "2026-10-25T05:00:01Z", ends_at: null }, now)).toBe(false)
    expect(isCampaignRunning({ starts_at: null, ends_at: now }, now)).toBe(false)
  })
})

describe("remainingUsage", () => {
  it("is limit - used for a usage budget", () => {
    expect(remainingUsage({ type: "usage", limit: 10, used: 3 })).toBe(7)
  })

  it("never goes below zero (sold out = 0, rule 4)", () => {
    expect(remainingUsage({ type: "usage", limit: 10, used: 12 })).toBe(0)
  })

  it("is null without a usage budget or limit", () => {
    expect(remainingUsage(null)).toBeNull()
    expect(remainingUsage({ type: "spend", limit: 1000, used: 10 })).toBeNull()
    expect(remainingUsage({ type: "usage", limit: null, used: 0 })).toBeNull()
  })
})
