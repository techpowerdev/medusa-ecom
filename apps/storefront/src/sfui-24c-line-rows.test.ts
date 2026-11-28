import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import {
  ACROSS_THIRDS,
  CODE,
  FLASH,
  GROUP_BUY,
  MIXED,
  SALE,
} from "@lib/util/price-breakdown.fixtures"
import { lineReferenceUnitPrice, lineUnitPrice, priceBreakdown } from "@lib/util/price-breakdown"

// SFUI-24c (spec 01 กฎข้อ 159–160, AC-202, AC-203): แถวสินค้าแสดงราคาต่อชิ้น × จำนวน (ไม่มียอดรวมต่อแถว),
// ราคาขีดฆ่าเฉพาะลดโดยไม่ต้องใส่โค้ด และรายการ "โค้ดส่วนลดที่ใช้" มีเฉพาะโค้ดของลูกค้า — render component ของจริง

vi.mock("@lib/data/cart", () => ({ updateLineItem: vi.fn(), deleteLineItem: vi.fn(), applyPromotions: vi.fn() }))
vi.mock("@modules/products/components/thumbnail", () => ({ default: () => null }))
vi.mock("@modules/common/components/localized-client-link", () => ({
  default: ({ children, href: _href, ...rest }: Record<string, unknown>) => createElement("a", rest, children as never),
}))

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8")

type Doc = typeof FLASH | typeof SALE | typeof CODE | typeof GROUP_BUY
const row = (doc: Doc, index = 0) => ({
  ...doc.items[index],
  product_title: "สินค้าทดสอบ",
  product_handle: "test",
  variant: { title: "M" },
})

const count = (html: string, testId: string) => html.split(`data-testid="${testId}"`).length - 1
const value = (html: string, testId: string) =>
  Number(html.match(new RegExp(`data-testid="${testId}"[^>]*data-value="([^"]*)"`))?.[1])
const text = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`))?.[1]
const amount = (s: string | undefined) => Number((s ?? "").replace(/[^0-9.]/g, ""))

async function renderCartItem(doc: Doc, type: "full" | "preview") {
  const { default: Item } = await import("@modules/cart/components/item")
  const wrap = (child: unknown) => createElement("table", null, createElement("tbody", null, child as never))
  return renderToStaticMarkup(
    wrap(createElement(Item, { item: row(doc) as never, type, currencyCode: "thb", promotions: doc.promotions }))
  )
}

async function renderOrderItem(doc: Doc) {
  const { default: Item } = await import("@modules/order/components/item")
  return renderToStaticMarkup(
    createElement(
      "table",
      null,
      createElement("tbody", null, createElement(Item, { item: row(doc) as never, currencyCode: "thb", promotions: doc.promotions }))
    )
  )
}

describe("helper ราคาต่อชิ้น (กฎข้อ 159a–c)", () => {
  it.each([
    ["flash", FLASH, 693, 990],
    ["sale", SALE, 450, 500],
    ["โค้ดอย่างเดียว", CODE, 590, 590],
    ["ซื้อกลุ่ม", GROUP_BUY, 800, 1000],
  ])("%s: ราคาต่อชิ้น/อ้างอิง", (_, doc, unit, reference) => {
    expect(lineUnitPrice(doc.items[0], doc.promotions)).toBeCloseTo(unit, 6)
    expect(lineReferenceUnitPrice(doc.items[0])).toBe(reference)
  })

  it.each([
    ["flash", FLASH],
    ["sale qty 2", SALE],
    ["โค้ด qty 2", CODE],
    ["ซื้อกลุ่ม 2 แถว", GROUP_BUY],
    ["ปน", MIXED],
    ["across ÷ 3", ACROSS_THIRDS],
  ])("%s: Σ (ราคาต่อชิ้น × จำนวน) = รวมค่าสินค้า (ค่าดิบ ±0.01)", (_, doc) => {
    const sum = doc.items.reduce((acc, item) => acc + lineUnitPrice(item, doc.promotions) * item.quantity, 0)
    expect(Math.abs(sum - priceBreakdown(doc).subtotal)).toBeLessThanOrEqual(0.01)
  })
})

describe("แถวของ /cart (type=full) และ preview ของ checkout (AC-202)", () => {
  it.each(["full", "preview"] as const)("%s: ไม่มี product-price/product-original-price มี product-unit-price 1 ตัว", async (type) => {
    const html = await renderCartItem(FLASH, type)
    expect(count(html, "product-price")).toBe(0)
    expect(count(html, "product-original-price")).toBe(0)
    expect(count(html, "product-unit-price")).toBe(1)
  })

  it("flash qty 1: ขีดฆ่า 990 ราคาต่อชิ้น 693 (แสดงแม้ qty 1)", async () => {
    const html = await renderCartItem(FLASH, "preview")
    expect(amount(text(html, "product-unit-original-price"))).toBe(990)
    expect(value(html, "product-unit-price")).toBeCloseTo(693, 6)
    expect(text(html, "product-quantity")).toBe("1")
  })

  it("sale qty 2: ขีดฆ่า = compare_at_unit_price 500, ราคาต่อชิ้น 450 × 2", async () => {
    const html = await renderCartItem(SALE, "preview")
    expect(amount(text(html, "product-unit-original-price"))).toBe(500)
    expect(value(html, "product-unit-price")).toBe(450)
    expect(text(html, "product-quantity")).toBe("2")
    expect(html).toContain("×")
  })

  it("มีแต่โค้ด: ไม่มีราคาขีดฆ่า ราคาต่อชิ้นไม่หักโค้ด (590)", async () => {
    const html = await renderCartItem(CODE, "preview")
    expect(count(html, "product-unit-original-price")).toBe(0)
    expect(value(html, "product-unit-price")).toBe(590)
  })

  it("/cart (full): จำนวนคือ select เดิม ไม่มีข้อความ × n ซ้ำ (กฎข้อ 159a)", async () => {
    const html = await renderCartItem(SALE, "full")
    expect(count(html, "product-select-button")).toBe(1)
    expect(count(html, "product-quantity")).toBe(0)
    expect(html).not.toContain("×")
    expect(amount(text(html, "product-unit-original-price"))).toBe(500)
  })
})

describe("แถวของ order (order-completed + account order details) (AC-202)", () => {
  it("ซื้อกลุ่ม: ขีดฆ่าราคาเดิม 1000 ราคาต่อชิ้น 800 × 1", async () => {
    const html = await renderOrderItem(GROUP_BUY)
    expect(count(html, "product-price")).toBe(0)
    expect(count(html, "product-original-price")).toBe(0)
    expect(amount(text(html, "product-unit-original-price"))).toBe(1000)
    expect(value(html, "product-unit-price")).toBeCloseTo(800, 6)
    expect(text(html, "product-quantity")).toBe("1")
  })
})

describe("DiscountCode: รายการโค้ดเฉพาะโค้ดของลูกค้า (กฎข้อ 160, AC-203)", () => {
  const render = async (promotions: object[]) => {
    const { default: DiscountCode } = await import("@modules/checkout/components/discount-code")
    return renderToStaticMarkup(createElement(DiscountCode, { cart: { id: "cart_1", promotions } as never }))
  }

  it("FLASH-SWEATER อัตโนมัติ + SAVE50 โค้ด → 1 แถว (SAVE50)", async () => {
    const html = await render([
      { id: "p1", code: "FLASH-SWEATER", is_automatic: true },
      { id: "p2", code: "SAVE50", is_automatic: false },
    ])
    expect(count(html, "discount-row")).toBe(1)
    expect(html).toContain("SAVE50")
    expect(html).not.toContain("FLASH-SWEATER")
  })

  it("มีแต่อัตโนมัติ → ไม่มีหัวข้อรายการ", async () => {
    const html = await render([{ id: "p1", code: "FLASH-SWEATER", is_automatic: true }])
    expect(count(html, "discount-row")).toBe(0)
    expect(html).not.toContain("โค้ดส่วนลดที่ใช้")
  })
})

describe("static (กฎข้อ 159a)", () => {
  it("ไม่มี line-item-price และ line-item-compare-at (ไม่มีผู้ใช้แล้ว)", () => {
    expect(existsSync(path.join(__dirname, "modules/common/components/line-item-price"))).toBe(false)
    expect(existsSync(path.join(__dirname, "lib/util/line-item-compare-at.ts"))).toBe(false)
  })

  it("หัวตารางของ /cart ไม่มีคอลัมน์ รวม", () => {
    expect(read("modules/cart/templates/items.tsx")).not.toMatch(/>\s*รวม\s*</)
  })
})
