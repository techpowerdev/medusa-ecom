import { HttpTypes } from "@medusajs/types"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

import { buildProductStructuredData } from "./product-structured-data"
import { DEFAULT_RETURN_WINDOW_DAYS } from "./return-request"
import { buildRegionsReturnPolicies, getRegionPolicies, getReturnPolicy } from "./store-policies"

// CORE-20d (spec 01 กฎข้อ 66a, AC-102): region ไม่ตั้ง return_window_days → ใช้ค่าเริ่มต้นเดียวกับ backend
// ทั้งหน้า /returns และ JSON-LD (ไม่ถือว่านโยบายคืน "ไม่มีข้อมูล" เพราะ key หาย)
const SHIPPING = {
  shipping_rate: 10,
  handling_days_min: 0,
  handling_days_max: 1,
  transit_days_min: 2,
  transit_days_max: 3,
}
const region = (metadata: Record<string, unknown> | null) =>
  ({
    id: "reg_r",
    name: "R",
    currency_code: "thb",
    metadata,
    countries: [{ iso_2: "la" }],
  }) as unknown as HttpTypes.StoreRegion

describe("getReturnPolicy", () => {
  it("ไม่มี return_window_days / ไม่มี metadata → ค่าเริ่มต้นของ backend, ไม่คืนค่าส่งฟรี", () => {
    for (const metadata of [null, {}, { return_window_days: "" }]) {
      expect(getReturnPolicy(region(metadata))).toEqual({
        returnWindowDays: DEFAULT_RETURN_WINDOW_DAYS,
        freeReturns: false,
      })
    }
  })

  it("ตั้งค่าไว้ → ใช้ค่านั้น", () => {
    expect(getReturnPolicy(region({ return_window_days: "7", free_returns: true }))).toEqual({
      returnWindowDays: 7,
      freeReturns: true,
    })
  })

  it("ไม่มี region → null", () => {
    expect(getReturnPolicy(undefined)).toBeNull()
  })
})

describe("getRegionPolicies", () => {
  it("มีค่าจัดส่งครบแต่ไม่มี return_window_days → ใช้ค่าเริ่มต้น (ไม่ null)", () => {
    expect(getRegionPolicies(region(SHIPPING))?.returnWindowDays).toBe(DEFAULT_RETURN_WINDOW_DAYS)
  })
})

describe("JSON-LD นโยบายคืนของ region ที่ไม่ตั้ง return_window_days", () => {
  it("buildRegionsReturnPolicies มีนโยบายคืนของประเทศใน region พร้อมจำนวนวันค่าเริ่มต้น", () => {
    expect(buildRegionsReturnPolicies([region(null)])).toEqual([
      expect.objectContaining({
        "@type": "MerchantReturnPolicy",
        applicableCountry: "LA",
        merchantReturnDays: DEFAULT_RETURN_WINDOW_DAYS,
      }),
    ])
  })

  it("structured data ของสินค้ามี hasMerchantReturnPolicy แม้ไม่มีค่าจัดส่ง (shippingDetails ไม่มี)", () => {
    const product = {
      id: "prod_1",
      title: "เสื้อ",
      handle: "shirt",
      variants: [{ id: "v1", sku: "S1", calculated_price: { calculated_amount: 100 } }],
    } as unknown as HttpTypes.StoreProduct
    const data = buildProductStructuredData({
      product,
      region: region({}),
      countryCode: "la",
      productUrl: "https://example.com/la/products/shirt",
    }) as { offers: Record<string, unknown> }
    expect(data.offers.hasMerchantReturnPolicy).toMatchObject({ merchantReturnDays: DEFAULT_RETURN_WINDOW_DAYS })
    expect(data.offers.shippingDetails).toBeUndefined()
  })
})
