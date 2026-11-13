import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import CartTotals from "@modules/common/components/cart-totals"

// CORE-57 (spec 01 กฎข้อ 115, AC-156; Q-C7 = ก): cart-totals แสดงทุกแถวด้วยฐานรวม VAT จาก field ที่ Medusa คำนวณ
// original_item_total − discount_total + original_shipping_total = total และแถว "รวม VAT แล้ว" เป็นข้อมูลไม่บวกซ้ำ
// fixture มี field ฐานก่อนภาษี (item_subtotal, shipping_subtotal) และ item_total/shipping_total แบบ cart จริง เพื่อยืนยันว่าไม่ถูกใช้
type Totals = Parameters<typeof CartTotals>[0]["totals"] & Record<string, unknown>

const render = (totals: Totals) => renderToStaticMarkup(createElement(CartTotals, { totals }))

/** data-value ของ element ที่มี data-testid นั้น (undefined = ไม่มีแถว) */
const value = (html: string, testId: string) => {
  const match = html.match(new RegExp(`data-testid="${testId}"[^>]*data-value="([^"]*)"`))
  return match ? Number(match[1]) : undefined
}

const sumOfRows = (html: string) =>
  (value(html, "cart-subtotal") ?? 0) - (value(html, "cart-discount") ?? 0) + (value(html, "cart-shipping") ?? 0)

const voucher = { requires_shipping: false }

/** ข้อความของทุก element ที่มี data-testid="cart-subtotal-label" (CORE-60) */
const subtotalLabels = (html: string) =>
  Array.from(html.matchAll(/data-testid="cart-subtotal-label"[^>]*>([^<]*)</g), (m) => m[1])

const FLASH = {
  currency_code: "thb",
  original_item_total: 5900,
  item_total: 4720,
  discount_total: 1180,
  original_shipping_total: 10,
  shipping_total: 10,
  tax_total: 309.44,
  total: 4730,
  item_subtotal: 5514.02,
  shipping_subtotal: 9.35,
}

const SHIPPING_DISCOUNT = {
  currency_code: "thb",
  original_item_total: 590,
  item_total: 590,
  discount_total: 10,
  original_shipping_total: 10,
  shipping_total: 0,
  tax_total: 38.6,
  total: 590,
}

describe("CORE-57: แถวของ cart-totals ใช้ฐานรวม VAT (AC-156)", () => {
  it("flash −20%: ค่าจัดส่ง = ราคา option ฿10 ไม่ใช่ shipping_subtotal ฿9.35 และแถวรวมได้ยอดสุทธิ", () => {
    const html = render(FLASH)

    expect(value(html, "cart-subtotal")).toBe(5900)
    expect(value(html, "cart-discount")).toBe(1180)
    expect(value(html, "cart-shipping")).toBe(10)
    expect(value(html, "cart-taxes")).toBe(309.44)
    expect(value(html, "cart-total")).toBe(4730)
    expect(Math.abs(sumOfRows(html) - 4730)).toBeLessThanOrEqual(0.01)
    // CORE-60 (กฎข้อ 118, AC-159): มีส่วนลด → ป้ายแถวแรกตรวจตาม AC-159 (describe ด้านล่าง)
    expect(subtotalLabels(html)).toHaveLength(1)
    expect(html).toContain("รวม VAT แล้ว")
    expect(html).not.toContain("ไม่รวมภาษี")
  })

  it("ส่วนลดค่าส่ง: cart-shipping = ราคา option ก่อนส่วนลด ไม่หักซ้ำกับแถวส่วนลด", () => {
    const html = render(SHIPPING_DISCOUNT)

    expect(value(html, "cart-shipping")).toBe(10)
    expect(value(html, "cart-discount")).toBe(10)
    expect(Math.abs(sumOfRows(html) - 590)).toBeLessThanOrEqual(0.01)
  })

  it("digital-only ไม่มีค่าจัดส่ง → ไม่มีแถวและคำว่าค่าจัดส่ง ป้ายยังเป็นรวม VAT", () => {
    const html = render({
      currency_code: "thb",
      original_item_total: 500,
      original_shipping_total: 0,
      shipping_subtotal: 9.35,
      tax_total: 32.71,
      total: 500,
      items: [voucher],
    })

    expect(html).not.toContain('data-testid="cart-shipping"')
    expect(html).not.toContain("ค่าจัดส่ง")
    expect(html).toContain("ยอดรวมสินค้า (รวม VAT)")
  })

  it("digital-only ที่ยังมีค่าจัดส่งเก็บจริง → คงแถวค่าจัดส่ง = original_shipping_total", () => {
    const html = render({
      currency_code: "thb",
      original_item_total: 500,
      original_shipping_total: 10,
      total: 510,
      items: [voucher],
    })

    expect(value(html, "cart-shipping")).toBe(10)
    expect(sumOfRows(html)).toBe(510)
  })
})

describe("CORE-60: ป้ายแถวแรกบอกว่าเป็นยอดก่อนส่วนลดเมื่อมีส่วนลด (กฎข้อ 118, AC-159)", () => {
  const labelOf = (totals: Totals) => {
    const html = render(totals)
    const labels = subtotalLabels(html)
    expect(labels, "cart-subtotal-label 1 ตัว").toHaveLength(1)
    return { html, label: labels[0] }
  }

  it("flash: ป้ายมีอักษรไทยและคำว่าก่อนส่วนลด ตัวเลขเท่าเดิม", () => {
    const { html, label } = labelOf(FLASH)
    expect(label).toMatch(/[฀-๿]/)
    expect(label).toContain("ก่อนส่วนลด")
    expect(value(html, "cart-subtotal")).toBe(5900)
  })

  it("ส่วนลดค่าส่งอย่างเดียว: ป้ายเท่ากับเคส flash", () => {
    expect(labelOf(SHIPPING_DISCOUNT).label).toBe(labelOf(FLASH).label)
  })

  it.each([
    ["discount_total: 0", { ...FLASH, discount_total: 0 }],
    ["ไม่ส่ง discount_total", { ...FLASH, discount_total: undefined }],
  ])("%s: ป้ายไม่มีคำว่าก่อนส่วนลด และต่างจากเคสมีส่วนลด", (_, totals) => {
    const { label } = labelOf(totals)
    expect(label).toMatch(/[฀-๿]/)
    expect(label).not.toContain("ก่อนส่วนลด")
    expect(label).not.toBe(labelOf(FLASH).label)
  })
})

describe("CORE-57: static — ไม่อ้าง field ฐานก่อนภาษีและไม่คำนวณ VAT เอง (กฎข้อ 115c)", () => {
  const source = readFileSync(
    path.join(__dirname, "modules/common/components/cart-totals/index.tsx"),
    "utf8"
  )

  it.each(["item_subtotal", "shipping_subtotal", "discount_subtotal", "1.07", "ไม่รวมภาษี", "ก่อน VAT"])(
    "ไม่มี %s",
    (needle) => {
      expect(source).not.toContain(needle)
    }
  )
})
