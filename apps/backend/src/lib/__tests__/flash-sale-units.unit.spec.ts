import { campaignUnitsInCart, flashSaleLockKey } from "../flash-sale-units"

// FS-3 (spec 03 กฎข้อ 9): units ต่อ campaign = ผลรวม quantity เต็มของ line ที่มี adjustment จาก promotion ของ campaign
describe("campaignUnitsInCart", () => {
  const campaignOf = { promo_a: "camp_a", promo_a2: "camp_a", promo_b: "camp_b" }

  it("returns nothing for a cart without adjustments", () => {
    expect(campaignUnitsInCart([{ quantity: 2, adjustments: [] }, { quantity: 1 }], campaignOf)).toEqual(
      []
    )
  })

  it("counts the full line quantity, not the discounted max_quantity", () => {
    expect(
      campaignUnitsInCart(
        [{ quantity: 3, adjustments: [{ promotion_id: "promo_a" }] }],
        campaignOf
      )
    ).toEqual([{ campaign_id: "camp_a", units: 3 }])
  })

  it("sums lines per campaign and sorts by campaign_id", () => {
    expect(
      campaignUnitsInCart(
        [
          { quantity: 2, adjustments: [{ promotion_id: "promo_b" }] },
          { quantity: 1, adjustments: [{ promotion_id: "promo_a" }] },
          { quantity: 4, adjustments: [{ promotion_id: "promo_a2" }] },
        ],
        campaignOf
      )
    ).toEqual([
      { campaign_id: "camp_a", units: 5 },
      { campaign_id: "camp_b", units: 2 },
    ])
  })

  it("counts a line once per campaign even with several adjustments of that campaign", () => {
    expect(
      campaignUnitsInCart(
        [
          {
            quantity: 2,
            adjustments: [{ promotion_id: "promo_a" }, { promotion_id: "promo_a2" }, { promotion_id: "promo_b" }],
          },
        ],
        campaignOf
      )
    ).toEqual([
      { campaign_id: "camp_a", units: 2 },
      { campaign_id: "camp_b", units: 2 },
    ])
  })

  it("ignores adjustments of promotions outside any known campaign and null entries", () => {
    expect(
      campaignUnitsInCart(
        [
          null,
          { quantity: 2, adjustments: [null, { promotion_id: "promo_x" }, { promotion_id: null }] },
        ],
        campaignOf
      )
    ).toEqual([])
  })

  it("accepts BigNumber-like quantities", () => {
    expect(
      campaignUnitsInCart(
        [{ quantity: { numeric: 2 } as unknown as number, adjustments: [{ promotion_id: "promo_b" }] }],
        campaignOf
      )
    ).toEqual([{ campaign_id: "camp_b", units: 2 }])
  })
})

describe("flashSaleLockKey", () => {
  it("namespaces the lock per (campaign_id, customer_id)", () => {
    expect(flashSaleLockKey("camp_a", "cus_1")).toEqual("flash_sale:customer:camp_a:cus_1")
  })
})
