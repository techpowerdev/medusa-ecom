import { describe, expect, it } from "vitest"

import { lineReferenceTotal } from "./line-item-compare-at"

// spec 01 กฎข้อ 125a / AC-166a (CORE-67): ยอดอ้างอิงก่อนลดของทั้ง line — ใช้ `compare_at_unit_price` ที่ Medusa ตั้งให้
// เมื่อราคามาจาก price list แบบ sale; นอกนั้นคง `original_total` (พฤติกรรมเดิม)
describe("lineReferenceTotal (AC-166a)", () => {
  it("ไม่มี compare_at_unit_price → original_total", () => {
    expect(lineReferenceTotal({ unit_price: 450, quantity: 2, original_total: 900 })).toBe(900)
  })

  it("sale 500 → 450 qty 2 (ราคารวม VAT) → 1000", () => {
    expect(
      lineReferenceTotal({ unit_price: 450, compare_at_unit_price: 500, quantity: 2, original_total: 900 })
    ).toBeCloseTo(1000, 6)
  })

  it("compare ≤ unit → original_total", () => {
    expect(
      lineReferenceTotal({ unit_price: 450, compare_at_unit_price: 450, quantity: 1, original_total: 450 })
    ).toBe(450)
    expect(
      lineReferenceTotal({ unit_price: 450, compare_at_unit_price: 449.999, quantity: 1, original_total: 450 })
    ).toBe(450)
  })

  it("ต่างไม่เกิน 0.005 → original_total", () => {
    expect(
      lineReferenceTotal({ unit_price: 450, compare_at_unit_price: 450.005, quantity: 1, original_total: 450 })
    ).toBe(450)
  })

  it("ฐานไม่รวมภาษี: unit 100, compare 120, original_total 107 → 128.4", () => {
    const ref = lineReferenceTotal({ unit_price: 100, compare_at_unit_price: 120, quantity: 1, original_total: 107 })
    expect(Math.abs(ref - 128.4)).toBeLessThanOrEqual(0.001)
  })

  it("unit_price 0 → original_total", () => {
    expect(lineReferenceTotal({ unit_price: 0, compare_at_unit_price: 120, quantity: 1, original_total: 0 })).toBe(0)
  })

  it("field เป็น null/undefined → original_total ?? 0", () => {
    expect(
      lineReferenceTotal({ unit_price: 450, compare_at_unit_price: null, quantity: 1, original_total: 450 })
    ).toBe(450)
    expect(lineReferenceTotal({ unit_price: 450, compare_at_unit_price: 500, quantity: 1, original_total: null })).toBe(0)
    expect(lineReferenceTotal({ quantity: 1 })).toBe(0)
  })
})
