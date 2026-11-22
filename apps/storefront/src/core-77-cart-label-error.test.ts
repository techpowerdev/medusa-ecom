// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-77 (spec 01 กฎข้อ 135, AC-176): อ่าน cart ของ nav ล้ม → ป้าย "ตะกร้า" ไม่มีตัวเลขและไม่ค้าง aria-busy;
// อ่านใหม่ 1 ครั้งเมื่อ pathname เปลี่ยน (ไม่วนซ้ำ ไม่ตั้ง timer) สำเร็จ → ตัวเลขตามกฎข้อ 130
const SOURCE = path.resolve(__dirname, "modules/layout/components/cart-dropdown/index.tsx")

const nav = vi.hoisted(() => ({ pathname: "/th" }))
const retrieveCart = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("@lib/data/cart", () => ({ retrieveCart, deleteLineItem: vi.fn() }))
vi.mock("@modules/products/components/thumbnail", () => ({ default: () => null }))
vi.mock("@modules/common/components/localized-client-link", () => ({
  default: ({ children, href: _href, passHref: _p, ...rest }: Record<string, unknown>) =>
    createElement("a", rest, children as never),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cart = (quantity: number) =>
  ({
    id: "cart_1",
    currency_code: "thb",
    items: [{ id: "item_1", title: "เสื้อยืด", quantity, created_at: "2026-11-03T00:00:00Z" }],
    item_total: 100 * quantity,
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (pathname: string) => {
  nav.pathname = pathname
  const { default: CartDropdown } = await import("@modules/layout/components/cart-dropdown")
  await act(async () => {
    root.render(createElement(CartDropdown, { cart: null }))
  })
}

const link = () => container.querySelector<HTMLElement>('[data-testid="nav-cart-link"]')!

describe("CORE-77: ป้ายตะกร้าเมื่ออ่าน cart ล้ม (กฎข้อ 135)", () => {
  beforeEach(() => {
    retrieveCart.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('ระหว่างโหลดยังเป็น "ตะกร้า" + aria-busy (กฎข้อ 130 เดิม)', async () => {
    retrieveCart.mockReturnValue(new Promise(() => {}))
    await render("/th")
    expect(link().textContent).toBe("ตะกร้า")
    expect(link().getAttribute("aria-busy")).toBe("true")
  })

  it('อ่านล้ม → "ตะกร้า" ไม่มีตัวเลขและไม่มี aria-busy', async () => {
    retrieveCart.mockRejectedValue(new Error("500"))
    await render("/th")
    expect(retrieveCart).toHaveBeenCalledTimes(1)
    expect(link().textContent).toBe("ตะกร้า")
    expect(link().hasAttribute("aria-busy")).toBe(false)
  })

  it("อ่านล้มแล้ว pathname เปลี่ยน → อ่านใหม่ 1 ครั้ง สำเร็จแสดงจำนวนจริง", async () => {
    retrieveCart.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(cart(2))
    await render("/th")
    await render("/th/store")
    expect(retrieveCart).toHaveBeenCalledTimes(2)
    expect(link().textContent).toBe("ตะกร้า (2)")
    expect(link().hasAttribute("aria-busy")).toBe(false)
  })

  it("อ่านใหม่ล้มซ้ำ → ไม่วนอ่านต่อจนกว่า pathname เปลี่ยนอีกครั้ง (ครั้งละ 1)", async () => {
    retrieveCart.mockRejectedValue(new Error("500"))
    await render("/th")
    await render("/th/store")
    await render("/th/store")
    expect(retrieveCart).toHaveBeenCalledTimes(2)
    expect(link().hasAttribute("aria-busy")).toBe(false)
    await render("/th/account")
    expect(retrieveCart).toHaveBeenCalledTimes(3)
  })

  it("อ่านสำเร็จแล้ว pathname เปลี่ยน → ไม่อ่านซ้ำ (ไม่เพิ่ม action ที่ e2e นับ)", async () => {
    retrieveCart.mockResolvedValue(cart(1))
    await render("/th")
    await render("/th/store")
    expect(retrieveCart).toHaveBeenCalledTimes(1)
    expect(link().textContent).toBe("ตะกร้า (1)")
  })

  it("static: ไม่ตั้ง timer เพื่อ retry (setTimeout มีเฉพาะปิด dropdown เอง ของ CORE-26)", () => {
    const src = fs.readFileSync(SOURCE, "utf8")
    expect(src.match(/setTimeout\(/g) ?? []).toHaveLength(1)
    expect(src).not.toMatch(/setInterval\(/)
  })
})
