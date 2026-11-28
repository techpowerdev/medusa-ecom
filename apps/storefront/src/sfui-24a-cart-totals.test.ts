import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import CartTotals from "@modules/common/components/cart-totals"
import {
  CODE,
  DIGITAL_ONLY,
  FLASH,
  FREE_SHIPPING_CODE,
  MIXED,
  TWO_RATES,
} from "@lib/util/price-breakdown.fixtures"

// SFUI-24a (spec 01 กฎข้อ 158a, 158f, AC-201): CartTotals เป็นสรุปยอดตัวเดียวของทุกหน้า ป้ายใหม่ไม่มีคำ VAT/ก่อนส่วนลด/ไม่รวมภาษี
// (แทน core-57-cart-totals.test.ts และส่วน CartTotals ของ ev-7d-digital-only-totals.test.ts)
type Totals = Parameters<typeof CartTotals>[0]["totals"]

const render = (totals: Totals) => renderToStaticMarkup(createElement(CartTotals, { totals }))
const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8")

/** data-value ของ element ที่มี data-testid นั้น (undefined = ไม่มีแถว) */
const value = (html: string, testId: string) => {
  const match = html.match(new RegExp(`data-testid="${testId}"[^>]*data-value="([^"]*)"`))
  return match ? Number(match[1]) : undefined
}

/** ข้อความของ element ป้าย (ป้ายไม่มี element ซ้อน) */
const text = (html: string, testId: string) => html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`))?.[1]

// testid ของป้ายตามกฎข้อ 158a (ค่าจัดส่ง/ยอดรวมทั้งสิ้นเป็นข้อความคงที่ ตรวจผ่าน html ทั้งก้อน)
const LABELS = ["cart-subtotal-label", "cart-discount-label", "cart-taxes-label"]

describe("CartTotals ป้ายใหม่ (AC-201)", () => {
  it.each([
    ["flash", FLASH],
    ["โค้ด", CODE],
    ["ปน", MIXED],
    ["ส่วนลดค่าส่ง", FREE_SHIPPING_CODE],
    ["สอง rate", TWO_RATES],
  ])("%s: ป้ายทุกแถวมีอักษรไทย และไม่มี VAT/ก่อนส่วนลด/ไม่รวมภาษี", (_, fixture) => {
    const html = render(fixture)
    const labels = LABELS.map((id) => text(html, id)).filter((t): t is string => t !== undefined)
    expect(labels.length).toBeGreaterThanOrEqual(1)
    for (const label of labels) {
      expect(label).toMatch(/[฀-๿]/)
      expect(label).not.toMatch(/VAT|ก่อนส่วนลด|ไม่รวมภาษี/)
    }
    expect(html).not.toMatch(/VAT|ก่อนส่วนลด|ไม่รวมภาษี/)
  })

  it("fixture (1) flash: ไม่มีแถวภาษีและแถวส่วนลด รวมค่าสินค้า 693 + ค่าส่ง 10 = 703", () => {
    const html = render(FLASH)
    expect(html).not.toContain('data-testid="cart-taxes"')
    expect(html).not.toContain('data-testid="cart-discount"')
    expect(value(html, "cart-subtotal")).toBeCloseTo(693, 6)
    expect(value(html, "cart-shipping")).toBeCloseTo(10, 6)
    expect(value(html, "cart-total")).toBe(703)
    expect(text(html, "cart-subtotal-label")).toBe("รวมค่าสินค้า")
  })

  it("fixture (2) โค้ด: cart-discount-label มี SAVE50 และ cart-discount = 50", () => {
    const html = render(CODE)
    expect(text(html, "cart-discount-label")).toContain("SAVE50")
    expect(value(html, "cart-discount")).toBeCloseTo(50, 6)
    expect(value(html, "cart-subtotal")).toBeCloseTo(1180, 6)
  })

  it("fixture (4) ปน: cart-taxes data-value=7 และป้ายมี 7%", () => {
    const html = render(MIXED)
    expect(value(html, "cart-taxes")).toBeCloseTo(7, 6)
    expect(text(html, "cart-taxes-label")).toContain("7%")
  })

  it("สอง rate: แถวภาษีไม่มี %", () => {
    const html = render(TWO_RATES)
    expect(value(html, "cart-taxes")).toBeCloseTo(27, 6)
    expect(text(html, "cart-taxes-label")).not.toContain("%")
  })

  it("digital-only ไม่มีค่าจัดส่ง → ไม่มีแถวและคำว่าค่าจัดส่ง", () => {
    const html = render(DIGITAL_ONLY)
    expect(html).not.toContain('data-testid="cart-shipping"')
    expect(html).not.toContain("ค่าจัดส่ง")
  })

  it("digital-only ที่ยังมีค่าจัดส่งเก็บจริง (Medusa ไม่ลบ shipping method) → คงแถวค่าจัดส่ง", () => {
    const html = render({ ...DIGITAL_ONLY, total: 510, shipping_methods: FLASH.shipping_methods })
    expect(value(html, "cart-shipping")).toBeCloseTo(10, 6)
  })
})

describe("static: ทุกหน้าใช้ CartTotals และ field ที่ helper ต้องใช้ (กฎข้อ 158, 158f)", () => {
  it("ไม่มี order/components/order-summary และ order-details-template ใช้ CartTotals", () => {
    expect(existsSync(path.join(__dirname, "modules/order/components/order-summary"))).toBe(false)
    const template = read("modules/order/templates/order-details-template.tsx")
    expect(template).toMatch(/import CartTotals from "@modules\/common\/components\/cart-totals"/)
    expect(template).toContain('data-testid="order-summary"')
    expect(template).toContain("สรุปคำสั่งซื้อ")
  })

  it("retrieveCart ขอ tax_total ของ line และ total/tax_total ของ shipping method", () => {
    const source = read("lib/data/cart.ts")
    for (const field of ["+items.tax_total", "+shipping_methods.total", "+shipping_methods.tax_total"]) {
      expect(source).toContain(field)
    }
  })

  it("retrieveOrder ขอ code/is_automatic ของ promotions", () => {
    const source = read("lib/data/orders.ts")
    for (const field of ["+promotions.code", "+promotions.is_automatic"]) {
      expect(source).toContain(field)
    }
  })
})
