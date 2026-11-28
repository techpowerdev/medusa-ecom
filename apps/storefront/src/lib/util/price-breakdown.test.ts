import { describe, expect, it } from "vitest"

import {
  ACROSS_THIRDS,
  AUTO_AND_CODE,
  CODE,
  DIGITAL_ONLY,
  EXCLUSIVE,
  FLASH,
  FREE_SHIPPING_AUTO,
  FREE_SHIPPING_CODE,
  GROUP_BUY,
  MIXED,
  MIXED_CODE,
  TWO_RATES,
  UNKNOWN_CODE,
} from "./price-breakdown.fixtures"
import { GROUP_BUY_CODE_PREFIX, isCustomerCode, lineAmount, priceBreakdown } from "./price-breakdown"

// SFUI-24a (spec 01 กฎข้อ 158b–e, AC-200): แยกส่วนลดอัตโนมัติ/โค้ด/ภาษีทีละรายการด้วยสูตรเดียวกับ Medusa
// fixture + ที่มาของสูตรอยู่ใน price-breakdown.fixtures.ts — ทุกเคสต้องได้เอกลักษณ์ของกฎข้อ 158d

type Fixture = Parameters<typeof priceBreakdown>[0]

const expectIdentity = (doc: Fixture) => {
  const b = priceBreakdown(doc)
  expect(b.total).toBe(doc.total)
  expect(Math.abs(b.subtotal + b.shipping - b.discount + b.tax - Number(doc.total)), JSON.stringify(b)).toBeLessThanOrEqual(0.01)
  return b
}

describe("priceBreakdown (AC-200)", () => {
  it("(1) รวม VAT ล้วน + flash 30%: 693 / 10 / ส่วนลด 0 / ภาษี 0 / 703", () => {
    const b = expectIdentity(FLASH)
    expect(b.subtotal).toBeCloseTo(693, 6)
    expect(b.shipping).toBeCloseTo(10, 6)
    expect(b.discount).toBe(0)
    expect(b.tax).toBe(0)
    expect(b.codes).toEqual([])
  })

  it("(2) มีโค้ด SAVE50: 1,180 / ส่วนลด 50 / 1,140, codes = [SAVE50]", () => {
    const b = expectIdentity(CODE)
    expect(b.subtotal).toBeCloseTo(1180, 6)
    expect(b.discount).toBeCloseTo(50, 6)
    expect(b.tax).toBe(0)
    expect(b.codes).toEqual(["SAVE50"])
  })

  it("(3) ไม่รวม VAT ล้วน: ภาษี 7 (rate 7%), total 107", () => {
    const b = expectIdentity(EXCLUSIVE)
    expect(b.subtotal).toBeCloseTo(100, 6)
    expect(b.shipping).toBe(0)
    expect(b.tax).toBeCloseTo(7, 6)
    expect(b.taxRate).toBe(7)
  })

  it("(4) ปน: 207 / 10 / ภาษี 7 (VAT ของ B เท่านั้น) / 224", () => {
    const b = expectIdentity(MIXED)
    expect(b.subtotal).toBeCloseTo(207, 6)
    expect(b.shipping).toBeCloseTo(10, 6)
    expect(b.tax).toBeCloseTo(7, 6)
    expect(b.taxRate).toBe(7)
  })

  it("(5) ปน + โค้ดทั้ง order (adjustment inclusive และไม่ inclusive): ส่วนลด 10.7 + 10 บนฐานของแต่ละรายการ", () => {
    const b = expectIdentity(MIXED_CODE)
    expect(b.subtotal).toBeCloseTo(207, 6)
    expect(b.discount).toBeCloseTo(20.7, 6)
    expect(b.tax).toBeCloseTo(6.3, 6)
    expect(b.codes).toEqual(["ORDER10"])
  })

  it("(6) อัตโนมัติ + โค้ดบน line เดียวกัน: flash อยู่ในรวมค่าสินค้า โค้ดอยู่ในส่วนลด", () => {
    const b = expectIdentity(AUTO_AND_CODE)
    expect(b.subtotal).toBeCloseTo(693, 6)
    expect(b.discount).toBeCloseTo(50, 6)
    expect(b.codes).toEqual(["SAVE50"])
  })

  it("(7) ส่วนลดค่าส่ง 100% จากโค้ด → ค่าจัดส่ง 10, ส่วนลด 10", () => {
    const b = expectIdentity(FREE_SHIPPING_CODE)
    expect(b.shipping).toBeCloseTo(10, 6)
    expect(b.discount).toBeCloseTo(10, 6)
    expect(b.codes).toEqual(["FREESHIP"])
  })

  it("(7) ส่วนลดค่าส่ง 100% อัตโนมัติ → ค่าจัดส่ง 0, ไม่มีส่วนลด", () => {
    const b = expectIdentity(FREE_SHIPPING_AUTO)
    expect(Math.abs(b.shipping)).toBeLessThanOrEqual(1e-9)
    expect(b.discount).toBe(0)
    expect(b.hasShippingCharge).toBe(true)
  })

  it("(8) qty 3 ส่วนลด across ฿100: ยอด line 200 (ค่าดิบ) — ต่อชิ้น 66.666…", () => {
    const b = expectIdentity(ACROSS_THIRDS)
    expect(b.subtotal).toBeCloseTo(200, 9)
    const item = ACROSS_THIRDS.items[0]
    expect(lineAmount(item, ACROSS_THIRDS.promotions) / item.quantity).toBeCloseTo(200 / 3, 9)
  })

  it("(9) GB-ABC (is_automatic: false) และ GB-XYZ ที่ไม่พบใน promotions → อัตโนมัติ ไม่อยู่ในส่วนลด", () => {
    const b = expectIdentity(GROUP_BUY)
    expect(b.subtotal).toBeCloseTo(1600, 6)
    expect(b.discount).toBe(0)
    expect(b.codes).toEqual([])
    expect(GROUP_BUY_CODE_PREFIX).toBe("GB-")
    expect(isCustomerCode("GB-ABC", GROUP_BUY.promotions)).toBe(false)
    expect(isCustomerCode("GB-XYZ", GROUP_BUY.promotions)).toBe(false)
  })

  it("(10) code ที่ไม่มีใน promotions → นับเป็นโค้ด (แสดงในบรรทัดส่วนลด)", () => {
    const b = expectIdentity(UNKNOWN_CODE)
    expect(b.discount).toBeCloseTo(30, 6)
    expect(b.codes).toEqual(["GONE30"])
    expect(isCustomerCode("GONE30", [])).toBe(true)
  })

  it("(11) rate ต่างกันสองค่า → taxRate = null (ป้ายไม่มี %)", () => {
    const b = expectIdentity(TWO_RATES)
    expect(b.tax).toBeCloseTo(27, 6)
    expect(b.taxRate).toBeNull()
  })

  it("(12) digital-only ไม่มี shipping method → ค่าจัดส่ง 0 และไม่มีค่าจัดส่งเก็บจริง", () => {
    const b = expectIdentity(DIGITAL_ONLY)
    expect(b.shipping).toBe(0)
    expect(b.hasShippingCharge).toBe(false)
  })

  it("promotion อัตโนมัติ/โค้ดตาม is_automatic ของ promotions", () => {
    expect(isCustomerCode("SAVE50", CODE.promotions)).toBe(true)
    expect(isCustomerCode("FLASH-SWEATER", FLASH.promotions)).toBe(false)
  })

  it("ข้อมูลไม่ครบ (ไม่มี items/shipping_methods/promotions) → 0 ไม่ throw", () => {
    expect(priceBreakdown({ total: 0 })).toMatchObject({ subtotal: 0, shipping: 0, discount: 0, tax: 0, total: 0, codes: [] })
  })
})
