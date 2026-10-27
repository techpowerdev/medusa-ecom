import { describe, expect, it } from "vitest"

import {
  type ActiveFlashSales,
  type FlashSale,
  cardFlashOffer,
  cardFlashPrices,
  cartFlashExceeded,
  countdownLabel,
  flashQtyExceeded,
  flashOfferForVariant,
  hasFlashCodeConflict,
  mergeActiveFlashSales,
} from "./flash-sale"

// FS-6 (spec 03 กฎข้อ 4, AC-4, AC-8 g, AC-13 e): logic ของ UI flash sale บน PDP/cart — pure

const NOW = new Date("2026-10-27T10:00:00Z").getTime()

const sale = (over: Partial<FlashSale> = {}): FlashSale => ({
  id: "camp_1",
  name: "Flash",
  starts_at: "2026-10-27T09:00:00Z",
  ends_at: "2026-10-27T11:00:00Z",
  banner_text: null,
  show_countdown: true,
  show_remaining: true,
  sold_out: false,
  remaining_units: 7,
  ...over,
})

const active = (
  s: FlashSale = sale(),
  flash_price: number | null = 472
): ActiveFlashSales => ({
  flash_sales: [s],
  variants: [
    {
      variant_id: "var_1",
      currency_code: "thb",
      original_price: 590,
      flash_price,
      campaign_id: flash_price == null ? null : s.id,
    },
    {
      variant_id: "var_2",
      currency_code: "thb",
      original_price: 590,
      flash_price: null,
      campaign_id: null,
    },
  ],
})

describe("flashOfferForVariant", () => {
  it("คืน campaign + ราคาของ variant ที่อยู่ในแคมเปญ", () => {
    const offer = flashOfferForVariant(active(), "var_1", NOW)
    expect(offer?.sale.id).toBe("camp_1")
    expect(offer?.price).toMatchObject({
      original_price: 590,
      flash_price: 472,
      currency_code: "thb",
    })
  })

  it("variant ที่ไม่อยู่ในแคมเปญ / ไม่มีข้อมูล / ไม่ได้เลือก variant → null", () => {
    expect(flashOfferForVariant(active(), "var_2", NOW)).toBeNull()
    expect(flashOfferForVariant(active(), "var_x", NOW)).toBeNull()
    expect(flashOfferForVariant(null, "var_1", NOW)).toBeNull()
    expect(flashOfferForVariant(active(), undefined, NOW)).toBeNull()
  })

  it("เลย ends_at แล้ว (นาฬิกาฝั่ง browser) → null — หน้าเลิกแสดงราคา flash โดยไม่ต้องโหลดใหม่", () => {
    expect(
      flashOfferForVariant(
        active(sale({ ends_at: "2026-10-27T10:00:00Z" })),
        "var_1",
        NOW
      )
    ).toBeNull()
    expect(
      flashOfferForVariant(active(sale({ ends_at: null })), "var_1", NOW)
    ).not.toBeNull()
  })

  it("sold_out ยังคืน offer เพื่อให้หน้าแสดง 'สินค้าหมด' (กฎข้อ 4)", () => {
    const offer = flashOfferForVariant(
      active(sale({ sold_out: true, remaining_units: 0 })),
      "var_1",
      NOW
    )
    expect(offer?.sale.sold_out).toBe(true)
  })
})

describe("countdownLabel", () => {
  it("เหลือน้อยกว่าวัน → HH:MM:SS", () => {
    expect(countdownLabel("2026-10-27T11:02:03Z", NOW)).toBe("01:02:03")
    expect(countdownLabel("2026-10-27T10:00:59Z", NOW)).toBe("00:00:59")
  })

  it("เกินหนึ่งวัน → N วัน HH:MM:SS (ภาษาไทย)", () => {
    expect(countdownLabel("2026-10-29T10:00:05Z", NOW)).toBe("2 วัน 00:00:05")
  })

  it("หมดเวลาแล้วหรือไม่มี ends_at → null", () => {
    expect(countdownLabel("2026-10-27T10:00:00Z", NOW)).toBeNull()
    expect(countdownLabel("2026-10-27T09:00:00Z", NOW)).toBeNull()
    expect(countdownLabel(null, NOW)).toBeNull()
  })
})

describe("hasFlashCodeConflict (AC-8 g)", () => {
  const code = { code: "SAVE10", is_automatic: false }
  const auto = { code: "FLASH20", is_automatic: true }

  it("cart มี code + สินค้า flash → true", () => {
    expect(hasFlashCodeConflict([code], active())).toBe(true)
  })

  it("ไม่มี code (มีแต่ automatic) → false", () => {
    expect(hasFlashCodeConflict([auto], active())).toBe(false)
    expect(hasFlashCodeConflict([], active())).toBe(false)
    expect(hasFlashCodeConflict(undefined, active())).toBe(false)
  })

  it("มี code แต่ไม่มีสินค้า flash ใน cart → false", () => {
    expect(hasFlashCodeConflict([code], active(sale(), null))).toBe(false)
    expect(hasFlashCodeConflict([code], null)).toBe(false)
  })
})

// FS-13 (spec 03 กฎข้อ 18, AC-19): ราคา flash บนการ์ด PLP + รวมผลของ request ที่แบ่งตามเพดาน 24 variant
describe("cardFlashOffer (FS-13)", () => {
  const price = (
    variant_id: string,
    flash_price: number | null,
    campaign_id: string | null = "camp_1"
  ) => ({
    variant_id,
    currency_code: "thb",
    original_price: 590,
    flash_price,
    campaign_id,
  })

  it("เลือก variant ที่ราคา flash ต่ำสุดของสินค้า", () => {
    const data: ActiveFlashSales = {
      flash_sales: [sale()],
      variants: [price("var_1", 500), price("var_2", 450), price("var_9", 100)],
    }
    expect(
      cardFlashOffer(data, ["var_1", "var_2"], NOW)?.price.flash_price
    ).toBe(450)
  })

  it("แคมเปญ sold_out / เลย ends_at / ไม่มี variant ในแคมเปญ → null (การ์ดแสดงราคาปกติ)", () => {
    expect(
      cardFlashOffer(active(sale({ sold_out: true })), ["var_1"], NOW)
    ).toBeNull()
    expect(
      cardFlashOffer(
        active(sale({ ends_at: "2026-10-27T10:00:00Z" })),
        ["var_1"],
        NOW
      )
    ).toBeNull()
    expect(cardFlashOffer(active(), ["var_2"], NOW)).toBeNull()
    expect(cardFlashOffer(null, ["var_1"], NOW)).toBeNull()
  })
})

describe("mergeActiveFlashSales (FS-13)", () => {
  it("รวม variants ทุกชุดและแคมเปญไม่ซ้ำ id; ชุดที่ล้ม (null) ถูกข้าม", () => {
    const a = active()
    const b: ActiveFlashSales = {
      flash_sales: [sale(), sale({ id: "camp_2" })],
      variants: [
        { ...a.variants[0], variant_id: "var_3", campaign_id: "camp_2" },
      ],
    }
    const merged = mergeActiveFlashSales([a, null, b])
    expect(merged?.flash_sales.map((s) => s.id)).toEqual(["camp_1", "camp_2"])
    expect(merged?.variants.map((v) => v.variant_id)).toEqual([
      "var_1",
      "var_2",
      "var_3",
    ])
  })

  it("ทุกชุดล้มหรือไม่มีชุด → null", () => {
    expect(mergeActiveFlashSales([null, null])).toBeNull()
    expect(mergeActiveFlashSales([])).toBeNull()
  })
})

describe("cardFlashPrices (FS-14)", () => {
  it("map ราคา flash ต่อสินค้า เฉพาะสินค้าที่มี variant ในแคมเปญ", () => {
    const prices = cardFlashPrices(
      active(),
      { prod_x: ["var_2", "var_1"], prod_y: ["var_2"], prod_z: [] },
      NOW
    )
    expect(Object.keys(prices)).toEqual(["prod_x"])
    expect(prices.prod_x).toMatchObject({
      variant_id: "var_1",
      flash_price: 472,
    })
  })

  it("ไม่มีข้อมูล flash → {}", () => {
    expect(cardFlashPrices(null, { prod_x: ["var_1"] }, NOW)).toEqual({})
  })
})

describe("flashQtyExceeded (FS-15 กฎข้อ 20a)", () => {
  const offer = (s: FlashSale) => flashOfferForVariant(active(s), "var_1", NOW)

  it("จำนวน > remaining_units → คืนจำนวนที่เหลือ; เท่ากับหรือน้อยกว่า → null", () => {
    const o = offer(sale({ remaining_units: 2 }))
    expect(flashQtyExceeded(o, 3)).toBe(2)
    expect(flashQtyExceeded(o, 2)).toBeNull()
    expect(flashQtyExceeded(o, 1)).toBeNull()
  })

  it("remaining_units = null (show_remaining=false หรือไม่มี total_cap) → ไม่เตือน", () => {
    expect(flashQtyExceeded(offer(sale({ remaining_units: null })), 10)).toBeNull()
  })

  it("ไม่มี offer หรือแคมเปญ sold out (FS-13 แสดง flash-sold-out แทน) → null", () => {
    expect(flashQtyExceeded(null, 10)).toBeNull()
    expect(
      flashQtyExceeded(offer(sale({ sold_out: true, remaining_units: 0 })), 1)
    ).toBeNull()
  })
})

describe("cartFlashExceeded (FS-15 กฎข้อ 20b)", () => {
  const promotions = [
    { id: "promo_flash", is_automatic: true },
    { id: "promo_code", is_automatic: false },
  ]
  const line = (over: object = {}) => ({
    id: "li_1",
    variant_id: "var_1",
    quantity: 3,
    adjustments: [{ promotion_id: "promo_flash" }],
    ...over,
  })
  const data = active(sale({ remaining_units: 2 }))

  it("line ที่มี adjustment ของ automatic promotion และ quantity > remaining_units → map line id → remaining", () => {
    expect(cartFlashExceeded([line()], promotions, data, NOW)).toEqual({
      li_1: 2,
    })
  })

  it("quantity ≤ remaining_units → ไม่เตือน", () => {
    expect(cartFlashExceeded([line({ quantity: 2 })], promotions, data, NOW)).toEqual({})
  })

  it("line ไม่มี adjustment ของ flash (ไม่มี หรือมีแต่ของ code — code ชนะ ADR-009) → ไม่เตือน", () => {
    expect(cartFlashExceeded([line({ adjustments: [] })], promotions, data, NOW)).toEqual({})
    expect(cartFlashExceeded([line({ adjustments: null })], promotions, data, NOW)).toEqual({})
    expect(
      cartFlashExceeded(
        [line({ adjustments: [{ promotion_id: "promo_code" }] })],
        promotions,
        data,
        NOW
      )
    ).toEqual({})
  })

  it("variant นอกแคมเปญ / remaining_units = null / ไม่มีข้อมูล flash → ไม่เตือน", () => {
    expect(cartFlashExceeded([line({ variant_id: "var_2" })], promotions, data, NOW)).toEqual({})
    expect(
      cartFlashExceeded([line()], promotions, active(sale({ remaining_units: null })), NOW)
    ).toEqual({})
    expect(cartFlashExceeded([line()], promotions, null, NOW)).toEqual({})
  })

  it("แคมเปญ sold out (remaining 0) → เตือน line นั้น (complete จะล้ม FLASH_SOLD_OUT)", () => {
    expect(
      cartFlashExceeded(
        [line({ quantity: 1 })],
        promotions,
        active(sale({ sold_out: true, remaining_units: 0 })),
        NOW
      )
    ).toEqual({ li_1: 0 })
  })
})
