// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-26 (spec 01 กฎข้อ 81, AC-117; qa #199): ยอดรวมใน dropdown ของตะกร้าต้องเป็น `item_total` ที่ Medusa คำนวณ
// (หลังส่วนลด รวม VAT — ตรงกับราคาต่อ line) และ dropdown ที่เปิดเองต้องปิดเองใน 5 วินาทีแม้ mouse อยู่ใต้ panel
const SOURCE = path.resolve(__dirname, "modules/layout/components/cart-dropdown/index.tsx")

vi.mock("next/navigation", () => ({ usePathname: () => "/th/products/t-shirt" }))
vi.mock("@lib/data/cart", () => ({ retrieveCart: vi.fn(), deleteLineItem: vi.fn() }))
vi.mock("@modules/products/components/thumbnail", () => ({ default: () => null }))
vi.mock("@modules/common/components/localized-client-link", () => ({
  default: ({ children, href: _href, passHref: _p, ...rest }: Record<string, unknown>) =>
    createElement("a", rest, children as never),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("CORE-26: static — ยอดรวมจาก field ของ Medusa ไม่คำนวณเอง (AC-117)", () => {
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

  it("ไม่หาร/คูณ 1.07 และใช้ item_total ไม่ใช่ subtotal", () => {
    expect(src).not.toMatch(/1\.07/)
    expect(src).toMatch(/\bitem_total\b/)
    expect(src).not.toMatch(/\.subtotal\b/)
  })
})

const line = (quantity: number) => ({
  id: "item_1",
  title: "เสื้อยืด",
  quantity,
  created_at: "2026-11-03T00:00:00Z",
  total: 2360 * quantity,
  original_total: 2950 * quantity,
  variant: { title: "M" },
})

const cart = (quantity: number) =>
  ({
    id: "cart_1",
    currency_code: "thb",
    items: [line(quantity)],
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

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

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

  it("ยอดรวม = item_total ป้าย 'ยอดรวมสินค้า (รวม VAT)' ไม่มี 'ไม่รวมภาษี'", async () => {
    await render(2)
    await hover(byTestId("nav-cart-link")!)
    const total = byTestId("cart-subtotal")!
    expect(Number(total.getAttribute("data-value"))).toBe(4720)
    const panel = byTestId("nav-cart-dropdown")!
    expect(panel.textContent).toContain("ยอดรวมสินค้า (รวม VAT)")
    expect(panel.textContent).not.toContain("ไม่รวมภาษี")
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
