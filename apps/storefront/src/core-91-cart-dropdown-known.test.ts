// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CART_UPDATED_EVENT } from "@lib/util/cart-events"

// CORE-91 (spec 01 กฎข้อ 147, AC-188): (a) dropdown ตะกร้าแสดง "ตะกร้าของคุณยังว่างอยู่" เฉพาะเมื่อรู้แน่ว่าว่าง
// ไม่ใช่ระหว่างโหลดหรือเมื่ออ่านล้ม; (b) server ส่ง cart มาแล้ว (รวม "ไม่มี cart" = null) → ไม่อ่านซ้ำตอน mount
const EMPTY_TEXT = "ตะกร้าของคุณยังว่างอยู่"

const nav = vi.hoisted(() => ({ pathname: "/th" }))
const retrieveCart = vi.hoisted(() => vi.fn())
const getCartId = vi.hoisted(() => vi.fn())
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }))

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.value }))
vi.mock("@lib/data/cart", () => ({ retrieveCart, deleteLineItem: vi.fn() }))
vi.mock("@lib/data/cookies", () => ({ getCartId }))
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

/** `cart` ไม่ส่ง = หน้า static (server อ่าน cookie ไม่ได้) / `null` = server รู้ว่าไม่มี cart */
const render = async (props: { cart?: unknown }) => {
  const { default: CartDropdown } = await import("@modules/layout/components/cart-dropdown")
  await act(async () => {
    root.render(createElement(CartDropdown, props as never))
  })
}

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/** ให้ React เห็น mouseenter (React สร้างจาก mouseover/mouseout) */
const hover = async () => {
  await act(async () => {
    byTestId("nav-cart-link")!.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body })
    )
  })
}

const panelText = () => byTestId("nav-cart-dropdown")!.textContent ?? ""

describe("CORE-91 (a): dropdown ไม่บอกว่าว่างเมื่อยังไม่รู้ (กฎข้อ 147a)", () => {
  beforeEach(() => {
    nav.pathname = "/th"
    retrieveCart.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("ระหว่างโหลด (หน้า static) → ไม่มีข้อความตะกร้าว่าง", async () => {
    retrieveCart.mockReturnValue(new Promise(() => {}))
    await render({})
    await hover()
    expect(byTestId("nav-cart-dropdown")).not.toBeNull()
    expect(panelText()).not.toContain(EMPTY_TEXT)
    expect(byTestId("nav-cart-dropdown-loading")).not.toBeNull()
  })

  it("อ่านล้ม → ไม่มีข้อความตะกร้าว่าง และมีลิงก์ไปหน้าตะกร้า", async () => {
    retrieveCart.mockRejectedValue(new Error("500"))
    await render({})
    await hover()
    expect(panelText()).not.toContain(EMPTY_TEXT)
    expect(byTestId("nav-cart-dropdown-error")).not.toBeNull()
  })

  it("client อ่านได้ว่าไม่มี cart → มีข้อความตะกร้าว่าง", async () => {
    retrieveCart.mockResolvedValue(null)
    await render({})
    await hover()
    expect(panelText()).toContain(EMPTY_TEXT)
  })

  it("server บอกว่าไม่มี cart (null) → มีข้อความตะกร้าว่าง ป้าย (0) ไม่ busy", async () => {
    retrieveCart.mockReturnValue(new Promise(() => {}))
    await render({ cart: null })
    await hover()
    expect(panelText()).toContain(EMPTY_TEXT)
    expect(byTestId("nav-cart-link")!.textContent).toBe("ตะกร้า (0)")
    expect(byTestId("nav-cart-link")!.hasAttribute("aria-busy")).toBe(false)
  })
})

describe("CORE-91 (b): server ส่ง cart แล้วไม่อ่านซ้ำตอน mount (กฎข้อ 147b)", () => {
  beforeEach(() => {
    nav.pathname = "/th/account"
    retrieveCart.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("server ส่ง cart → retrieveCart 0 ครั้ง", async () => {
    await render({ cart: cart(2) })
    expect(retrieveCart).not.toHaveBeenCalled()
    expect(byTestId("nav-cart-link")!.textContent).toBe("ตะกร้า (2)")
  })

  it("server บอกว่าไม่มี cart → retrieveCart 0 ครั้งตอน mount; แก้ cart (event) แล้วจึงอ่าน 1 ครั้ง", async () => {
    retrieveCart.mockResolvedValue(cart(1))
    await render({ cart: null })
    expect(retrieveCart).not.toHaveBeenCalled()
    await act(async () => {
      window.dispatchEvent(new Event(CART_UPDATED_EVENT))
    })
    expect(retrieveCart).toHaveBeenCalledTimes(1)
    expect(byTestId("nav-cart-link")!.textContent).toBe("ตะกร้า (1)")
  })
})

describe("CORE-91 (b): CartButton บอก CartDropdown ว่า server รู้ cart หรือไม่", () => {
  const cartPropOf = async () => {
    const { default: CartButton } = await import("@modules/layout/components/cart-button")
    const element = (await CartButton()) as ReactElement<{ cart?: unknown }>
    return element.props.cart
  }

  beforeEach(() => {
    retrieveCart.mockReset()
    getCartId.mockReset()
  })

  it("หน้า force-static (headers ว่าง ไม่มี request จริง) → undefined ให้ client อ่านเอง ไม่อ่าน cookie", async () => {
    requestHeaders.value = new Headers()
    expect(await cartPropOf()).toBeUndefined()
    expect(retrieveCart).not.toHaveBeenCalled()
  })

  it("หน้า dynamic ไม่มี cookie cart → null (รู้แน่ว่าไม่มี cart) ไม่เรียก retrieveCart", async () => {
    requestHeaders.value = new Headers({ host: "localhost:8000" })
    getCartId.mockResolvedValue(undefined)
    expect(await cartPropOf()).toBeNull()
    expect(retrieveCart).not.toHaveBeenCalled()
  })

  it("หน้า dynamic มี cart → ส่ง cart", async () => {
    requestHeaders.value = new Headers({ host: "localhost:8000" })
    getCartId.mockResolvedValue("cart_1")
    retrieveCart.mockResolvedValue(cart(3))
    expect(await cartPropOf()).toMatchObject({ id: "cart_1" })
  })

  it("หน้า dynamic มี cookie แต่อ่าน cart ไม่ได้ (ล้ม/ไม่พบ) → undefined ให้ client อ่าน (ไม่บอกว่าว่าง)", async () => {
    requestHeaders.value = new Headers({ host: "localhost:8000" })
    getCartId.mockResolvedValue("cart_1")
    retrieveCart.mockResolvedValue(null)
    expect(await cartPropOf()).toBeUndefined()
    retrieveCart.mockRejectedValue(new Error("500"))
    expect(await cartPropOf()).toBeUndefined()
  })
})
