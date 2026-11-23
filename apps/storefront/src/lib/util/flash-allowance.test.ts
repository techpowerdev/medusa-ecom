import { describe, expect, it } from "vitest"

import {
  type FlashAllowance,
  cartCustomerLimitExceeded,
  flashCampaignVariantIds,
  pdpCustomerLimit,
  pdpQuantityOptions,
} from "./flash-allowance"
import type { ActiveFlashSales, FlashOffer, FlashSale } from "./flash-sale"

// FS-21 (spec 03 กฎข้อ 26, AC-28): จำกัดจำนวนตามสิทธิ์ flash ที่เหลือของลูกค้า — pure

const sale = (over: Partial<FlashSale> = {}): FlashSale => ({
  id: "camp_1",
  name: "Flash",
  starts_at: null,
  ends_at: null,
  banner_text: null,
  show_countdown: false,
  show_remaining: true,
  sold_out: false,
  remaining_units: null,
  per_customer_limit: null,
  ...over,
})

const offer = (over: Partial<FlashSale> = {}): FlashOffer => ({
  sale: sale(over),
  price: {
    variant_id: "var_1",
    currency_code: "thb",
    original_price: 590,
    flash_price: 472,
    campaign_id: "camp_1",
  },
})

const allowance = (over: Partial<FlashAllowance> = {}): FlashAllowance => ({
  variant_id: "var_1",
  campaign_id: "camp_1",
  per_customer_limit: 2,
  used_units: 0,
  remaining_for_customer: 2,
  ...over,
})

describe("flashCampaignVariantIds", () => {
  it("คืนเฉพาะ variant ที่ FS-4 บอกว่ามี campaign_id (ไม่ซ้ำ)", () => {
    const data: ActiveFlashSales = {
      flash_sales: [sale()],
      variants: [
        { variant_id: "var_1", currency_code: "thb", original_price: 1, flash_price: 1, campaign_id: "camp_1" },
        { variant_id: "var_2", currency_code: "thb", original_price: 1, flash_price: null, campaign_id: null },
        { variant_id: "var_1", currency_code: "thb", original_price: 1, flash_price: 1, campaign_id: "camp_1" },
      ],
    }
    expect(flashCampaignVariantIds(data)).toEqual(["var_1"])
  })

  it("ไม่มีข้อมูล → []", () => {
    expect(flashCampaignVariantIds(null)).toEqual([])
  })
})

describe("pdpCustomerLimit (กฎข้อ 26a)", () => {
  it("สูงสุด = remaining_for_customer เมื่อไม่รู้ remaining_units", () => {
    expect(pdpCustomerLimit(offer(), [allowance({ per_customer_limit: 1, remaining_for_customer: 1 })], "var_1")).toEqual({
      limit: 1,
      remaining: 1,
      max: 1,
      in_cart: 0,
    })
  })

  it("สูงสุด = min(remaining_for_customer, remaining_units)", () => {
    expect(pdpCustomerLimit(offer({ remaining_units: 1 }), [allowance()], "var_1")?.max).toBe(1)
    expect(pdpCustomerLimit(offer({ remaining_units: 5 }), [allowance()], "var_1")?.max).toBe(2)
  })

  it("ใช้สิทธิ์ครบแล้ว → max 0", () => {
    expect(
      pdpCustomerLimit(offer(), [allowance({ per_customer_limit: 1, used_units: 1, remaining_for_customer: 0 })], "var_1")
    ).toEqual({ limit: 1, remaining: 0, max: 0, in_cart: 0 })
  })

  it("ไม่จำกัดต่อคน / ไม่มี allowance ของ variant / ไม่มี offer → null", () => {
    expect(
      pdpCustomerLimit(offer(), [allowance({ per_customer_limit: null, remaining_for_customer: null })], "var_1")
    ).toBeNull()
    expect(pdpCustomerLimit(offer(), [allowance({ variant_id: "var_2" })], "var_1")).toBeNull()
    expect(pdpCustomerLimit(null, [allowance()], "var_1")).toBeNull()
  })

  // FS-23 (กฎข้อ 28b): ไม่ login → ไม่มี allowance แต่แคมเปญจำกัด → แสดงเฉพาะ limit (ไม่มีสิทธิ์ที่เหลือ ไม่จำกัดตัวเลือก)
  it("ไม่มี allowance ของ variant และแคมเปญจำกัดต่อคน → { limit, remaining: null, max: null }", () => {
    expect(pdpCustomerLimit(offer({ per_customer_limit: 2 }), [], "var_1")).toEqual({
      limit: 2,
      remaining: null,
      max: null,
      in_cart: 0,
    })
    expect(pdpCustomerLimit(offer({ per_customer_limit: null }), [], "var_1")).toBeNull()
  })
})

// FS-23 (spec 03 กฎข้อ 28c, AC-30 d): หักจำนวนของ line ในตะกร้าที่ variant อยู่ในแคมเปญเดียวกัน
describe("pdpCustomerLimit + ของในตะกร้า (กฎข้อ 28c)", () => {
  const allowances = [
    allowance(),
    allowance({ variant_id: "var_2" }),
    allowance({ variant_id: "var_other", campaign_id: "camp_2", per_customer_limit: 5, remaining_for_customer: 5 }),
  ]
  const line = (variant_id: string | null, quantity: number) => ({ variant_id, quantity })

  it("ไม่มีของในตะกร้า → ไม่หัก", () => {
    expect(pdpCustomerLimit(offer(), allowances, "var_1", [])).toEqual({ limit: 2, remaining: 2, max: 2, in_cart: 0 })
  })

  it("ของในตะกร้าคนละแคมเปญ / ไม่อยู่ในแคมเปญ → ไม่หัก", () => {
    expect(
      pdpCustomerLimit(offer(), allowances, "var_1", [line("var_other", 3), line("var_plain", 4), line(null, 1)])
    ).toEqual({ limit: 2, remaining: 2, max: 2, in_cart: 0 })
  })

  it("หลาย variant ในแคมเปญเดียว (รวม variant ที่เลือกเอง) → หักผลรวม", () => {
    expect(pdpCustomerLimit(offer(), allowances, "var_1", [line("var_2", 1)])).toEqual({
      limit: 2,
      remaining: 1,
      max: 1,
      in_cart: 1,
    })
    expect(pdpCustomerLimit(offer(), allowances, "var_1", [line("var_1", 1), line("var_2", 1)])).toEqual({
      limit: 2,
      remaining: 0,
      max: 0,
      in_cart: 2,
    })
  })

  it("ผลไม่ติดลบเมื่อของในตะกร้าเกินสิทธิ์ที่เหลือ", () => {
    expect(
      pdpCustomerLimit(offer(), [allowance({ used_units: 1, remaining_for_customer: 1 })], "var_1", [line("var_1", 3)])
    ).toEqual({ limit: 2, remaining: 0, max: 0, in_cart: 3 })
  })

  it("ยังเคารพ remaining_units ของแคมเปญหลังหัก", () => {
    expect(
      pdpCustomerLimit(offer({ remaining_units: 1 }), [allowance({ per_customer_limit: 5, remaining_for_customer: 5 })], "var_1", [
        line("var_1", 1),
      ])?.max
    ).toBe(1)
  })
})

describe("pdpQuantityOptions", () => {
  const base = [1, 2, 3, 4, 5]
  it("ตัดตัวเลือกที่เกิน max", () => {
    expect(pdpQuantityOptions(base, 2)).toEqual([1, 2])
  })
  it("max 0 → [1] (ปุ่มถูก disable แยก)", () => {
    expect(pdpQuantityOptions(base, 0)).toEqual([1])
  })
  it("ไม่จำกัด → เท่าเดิม", () => {
    expect(pdpQuantityOptions(base, null)).toBe(base)
  })
})

describe("cartCustomerLimitExceeded (กฎข้อ 26b)", () => {
  const promotions = [
    { id: "promo_flash", is_automatic: true },
    { id: "promo_code", is_automatic: false },
  ]
  const line = (id: string, variant_id: string, quantity: number, promotion_id = "promo_flash") => ({
    id,
    variant_id,
    quantity,
    adjustments: [{ promotion_id }],
  })

  it("line flash qty 2 ขณะเหลือสิทธิ์ 1 → { line: 1 }", () => {
    expect(
      cartCustomerLimitExceeded([line("li_1", "var_1", 2)], promotions, [
        allowance({ per_customer_limit: 1, remaining_for_customer: 1 }),
      ])
    ).toEqual({ li_1: 1 })
  })

  it("ไม่เกิน → {}", () => {
    expect(cartCustomerLimitExceeded([line("li_1", "var_1", 2)], promotions, [allowance()])).toEqual({})
  })

  it("รวมจำนวนของ line อื่นในแคมเปญเดียวกัน → เตือนทุก line ของแคมเปญนั้น", () => {
    const allowances = [allowance(), allowance({ variant_id: "var_2" })]
    expect(
      cartCustomerLimitExceeded([line("li_1", "var_1", 2), line("li_2", "var_2", 1)], promotions, allowances)
    ).toEqual({ li_1: 2, li_2: 2 })
  })

  it("line ที่ไม่ได้ส่วนลด flash (code ชนะ / ไม่มี adjustment) ไม่นับ", () => {
    expect(
      cartCustomerLimitExceeded(
        [line("li_1", "var_1", 3, "promo_code"), { id: "li_2", variant_id: "var_1", quantity: 3, adjustments: [] }],
        promotions,
        [allowance()]
      )
    ).toEqual({})
  })

  it("ไม่จำกัดต่อคน / variant ไม่มี allowance → {}", () => {
    expect(
      cartCustomerLimitExceeded([line("li_1", "var_1", 9)], promotions, [
        allowance({ per_customer_limit: null, remaining_for_customer: null }),
      ])
    ).toEqual({})
    expect(cartCustomerLimitExceeded([line("li_1", "var_9", 9)], promotions, [allowance()])).toEqual({})
  })
})
