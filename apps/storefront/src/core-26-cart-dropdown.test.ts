// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-26 (spec 01 กฎข้อ 81, AC-117; qa #199): dropdown ที่เปิดเองต้องปิดเองใน 5 วินาทีแม้ mouse อยู่ใต้ panel
// SFUI-24c (กฎข้อ 159d แทนกฎข้อ 81a): บรรทัดยอด = "รวมค่าสินค้า" จาก price-breakdown ตัวเดียวกับ CartTotals
// และแถวแสดงราคาต่อชิ้น × จำนวน (ไม่มียอดรวมต่อแถว)
const SOURCE = path.resolve(__dirname, "modules/layout/components/cart-dropdown/index.tsx")

vi.mock("next/navigation", () => ({ usePathname: () => "/th/products/t-shirt" }))
vi.mock("@lib/data/cart", () => ({ retrieveCart: vi.fn(), deleteLineItem: vi.fn() }))
vi.mock("@modules/products/components/thumbnail", () => ({ default: () => null }))
vi.mock("@modules/common/components/localized-client-link", () => ({
  default: ({ children, href: _href, passHref: _p, ...rest }: Record<string, unknown>) =>
    createElement("a", rest, children as never),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("CORE-26 / SFUI-24c: static — ยอดรวมจาก helper เดียวกับ CartTotals ไม่คำนวณเองใน component", () => {
  const src = fs.readFileSync(SOURCE, "utf8")
  // ยกเว้น `countItems` ที่รวม `quantity` (ไม่ใช่ราคา)
  const withoutCountItems = src.replace(/const countItems = [\s\S]*?\n\n/, "")

  it("regex ของ reduce จับโค้ดรูปแบบที่ใช้จริง (arrow function ใน reduce)", () => {
    const re = /\.reduce\([\s\S]*?\b(unit_price|total|subtotal)\b/
    expect(re.test("items.reduce((acc, i) => acc + i.total, 0)")).toBe(true)
    expect(re.test("items.reduce((acc, i) => acc + i.quantity, 0)")).toBe(false)
    expect(withoutCountItems).not.toMatch(re)
    expect(src, "countItems ต้องยังอยู่ (ไม่ใช่ regex ยกเว้นผิดที่)").toMatch(/const countItems = /)
  })

  it("ไม่หาร/คูณ 1.07 และใช้ priceBreakdown ไม่ใช่ item_total", () => {
    expect(src).not.toMatch(/1\.07/)
    expect(src).toMatch(/\bpriceBreakdown\(/)
    expect(src).not.toMatch(/\bitem_total\b/)
  })
})

// flash −20% (อัตโนมัติ) บนราคารวม VAT 2,950 → 2,360 ต่อชิ้น
const line = (quantity: number) => ({
  id: "item_1",
  title: "เสื้อยืด",
  quantity,
  created_at: "2026-11-03T00:00:00Z",
  unit_price: 2950,
  is_tax_inclusive: true,
  tax_lines: [{ rate: 7 }],
  adjustments: [{ code: "FLASH-TSHIRT", amount: 590 * quantity, is_tax_inclusive: true }],
  total: 2360 * quantity,
  original_total: 2950 * quantity,
  variant: { title: "M" },
})

const cart = (quantity: number) =>
  ({
    id: "cart_1",
    currency_code: "thb",
    items: [line(quantity)],
    promotions: [{ id: "promo_flash", code: "FLASH-TSHIRT", is_automatic: true }],
    subtotal: 5514.02,
    item_total: 2360 * quantity,
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (quantity: number) => {
  const { default: CartDropdown } = await import("@modules/layout/components/cart-dropdown")
  await act(async () => {
    root.render(createElement(CartDropdown, { cart: cart(quantity) }))
  })
}

// SFUI-3c: nav-cart-dropdown เป็น PopoverContent ของ Radix ที่ render ผ่าน Portal ใต้ document.body (ไม่อยู่ใน container)
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/** ให้ React เห็น mouseenter (React สร้างจาก mouseover/mouseout) */
const hover = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }))
  })
}

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe("CORE-26: dropdown ของตะกร้า (กฎข้อ 81)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it("ยอด = รวมค่าสินค้าจาก helper (4,720) ป้าย 'รวมค่าสินค้า' แถวแสดงราคาต่อชิ้น × จำนวน ไม่มียอดรวมต่อแถว", async () => {
    await render(2)
    await hover(byTestId("nav-cart-link")!)
    const total = byTestId("cart-subtotal")!
    expect(Number(total.getAttribute("data-value"))).toBe(4720)
    expect(byTestId("cart-subtotal-label")!.textContent).toBe("รวมค่าสินค้า")
    const panel = byTestId("nav-cart-dropdown")!
    expect(panel.textContent).not.toMatch(/VAT|ไม่รวมภาษี/)
    const item = panel.querySelector('[data-testid="cart-item"]')!
    expect(item.querySelectorAll('[data-testid="product-price"]')).toHaveLength(0)
    expect(item.querySelector('[data-testid="product-unit-price"]')!.getAttribute("data-value")).toBe("2360")
    expect(item.querySelector('[data-testid="product-unit-original-price"]')!.textContent).toContain("2,950")
    expect(item.querySelector('[data-testid="product-quantity"]')!.textContent).toBe("2")
  })

  it("เปิดเองหลังจำนวนเปลี่ยน แล้ว mouse อยู่ใต้ panel → ยังปิดเองภายใน 5 วินาที", async () => {
    await render(1)
    expect(byTestId("nav-cart-dropdown")).toBeNull()
    await render(2)
    const panel = byTestId("nav-cart-dropdown")!
    expect(panel).not.toBeNull()
    // panel เปิดทับปุ่มที่ลูกค้าเพิ่งกด — mouse ที่ค้างอยู่ตรงนั้นจึง "เข้า" panel
    await hover(panel)
    await advance(5000)
    await advance(1000)
    expect(byTestId("nav-cart-dropdown")).toBeNull()
  })

  it("ชี้ nav-cart-link → เปิดค้างตามเดิมของ starter (ยกเลิกการปิดเอง)", async () => {
    await render(1)
    await render(2)
    await hover(byTestId("nav-cart-link")!)
    await advance(10_000)
    expect(byTestId("nav-cart-dropdown")).not.toBeNull()
  })
})
