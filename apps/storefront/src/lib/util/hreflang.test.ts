import { describe, expect, it } from "vitest"

import { hreflangAlternates } from "./hreflang"

// CORE-4b2 (owner 2026-10-26, ADR-014): เนื้อหาเป็นภาษาไทย (`<html lang="th">`) จึงประกาศ hreflang เป็น th-<CC>
describe("hreflangAlternates", () => {
  it("หน้าแรก: th-<CC> ต่อประเทศ ชี้ไปที่ /<cc>", () => {
    expect(hreflangAlternates("https://shop.example", ["th", "la"])).toEqual({
      "th-TH": "https://shop.example/th",
      "th-LA": "https://shop.example/la",
    })
  })

  it("PDP: ต่อ path ของสินค้า", () => {
    expect(
      hreflangAlternates("https://shop.example", ["th"], "/products/t-shirt")
    ).toEqual({ "th-TH": "https://shop.example/th/products/t-shirt" })
  })

  it("ไม่มี key ที่ขึ้นต้นด้วย en-", () => {
    const keys = Object.keys(hreflangAlternates("https://x", ["th", "us"]))
    expect(keys.some((k) => k.startsWith("en-"))).toBe(false)
  })
})
