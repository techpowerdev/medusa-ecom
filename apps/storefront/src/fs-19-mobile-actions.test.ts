// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// FS-19 (spec 03 กฎข้อ 24, AC-26): แถบล่างของ PDP บนมือถือ (`MobileActions`)
// (a) `mobile-cart-button` รอข้อมูล flash แบบเดียวกับ `add-product-button` (disabled + aria-busy ระหว่าง `flash.loading`)
// (b) เมื่อปุ่มหลักเข้าจอ แถบซ่อนทันที (ไม่จางทับปุ่มหลัก) — ไม่อยู่ใน DOM หลัง render ที่ `show=false`
let inView: boolean | null = false
let flashLoading = true

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/th/products/t-shirt",
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/hooks/use-in-view", () => ({ useIntersection: () => inView }))
vi.mock("@modules/products/components/flash-sale", () => ({
  default: () => null,
  FlashPrice: () => null,
  useFlashOffer: () => ({ offer: null, loading: flashLoading }),
}))
vi.mock("@modules/products/components/product-price", () => ({ default: () => null }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const product = {
  id: "prod_tshirt",
  options: [{ id: "opt_size", title: "Size", values: [{ value: "S" }, { value: "M" }] }],
  variants: [
    { id: "variant_s", manage_inventory: false, options: [{ option_id: "opt_size", value: "S" }] },
    { id: "variant_m", manage_inventory: false, options: [{ option_id: "opt_size", value: "M" }] },
  ],
} as never

let container: HTMLDivElement
let root: Root

const render = async () => {
  const { default: ProductActions } = await import("@modules/products/components/product-actions")
  await act(async () => {
    root.render(createElement(ProductActions, { product, region: { id: "reg_th" } as never }))
  })
}

const q = (id: string) => container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)

describe("FS-19: แถบล่างของ PDP บนมือถือ (กฎข้อ 24)", () => {
  beforeEach(() => {
    inView = false
    flashLoading = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("(a) ระหว่าง flash.loading → mobile-cart-button disabled + aria-busy=true เหมือน add-product-button", async () => {
    await render()
    expect(q("add-product-button")!.disabled).toBe(true)
    expect(q("mobile-cart-button")!.disabled).toBe(true)
    expect(q("mobile-cart-button")!.getAttribute("aria-busy")).toBe("true")
  })

  it("(a) flash ตอบแล้ว (สำเร็จหรือ error) → mobile-cart-button กดได้ และไม่อยู่ในสถานะรอ", async () => {
    flashLoading = false
    await render()
    expect(q("mobile-cart-button")!.disabled).toBe(false)
    expect(q("mobile-cart-button")!.getAttribute("aria-busy")).not.toBe("true")
  })

  it("(b) ปุ่มหลักเข้าจอ → แถบล่างหายจาก DOM ทันทีใน render เดียวกัน (ไม่มี leave transition จางทับ)", async () => {
    flashLoading = false
    await render()
    expect(q("mobile-actions")).not.toBeNull()

    inView = true
    await render()
    expect(q("mobile-actions"), "แถบต้องไม่ค้างใน DOM ระหว่างจาง").toBeNull()
  })
})
