// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-25 (spec 01 กฎข้อ 78, AC-116; qa #178): option ที่ลูกค้าเลือกบน PDP ต้องไม่ถูกรีเซ็ตเป็นค่าจาก `v_id` ใน URL
// เมื่อ effect ที่ขึ้นกับ `product.variants` ทำงานซ้ำ — เช่น RSC refresh หลัง server action (add-to-cart) ส่ง `product`
// object ใหม่มาก่อนที่ `router.replace` ของตัวเลือกใหม่จะ commit URL (URL ยังเป็น `v_id` ของตัวเลือกเดิม)
const S = "variant_s"
const M = "variant_m"

// router.replace ไม่เปลี่ยน URL = navigation ที่ยังไม่ commit (สถานะที่ trace ของ CI จับได้)
const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }
const addToCart = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/th/products/t-shirt",
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/cart", () => ({
  addToCart: (...a: unknown[]) => addToCart(...a),
}))
vi.mock("@lib/hooks/use-in-view", () => ({ useIntersection: () => true }))
vi.mock("@modules/products/components/flash-sale", () => ({
  default: () => null,
  useFlashOffer: () => ({ offer: null, loading: false }),
}))
vi.mock("@modules/products/components/product-price", () => ({ default: () => null }))
vi.mock("@modules/products/components/product-actions/mobile-actions", () => ({
  default: () => null,
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const variant = (id: string, size: string) => ({
  id,
  manage_inventory: false,
  options: [{ option_id: "opt_size", value: size }],
})

// ทุกครั้งที่เรียกได้ object/array ใหม่ (เหมือน RSC payload ที่ deserialize ใหม่) แต่ข้อมูลเดิม
const product = () =>
  ({
    id: "prod_tshirt",
    options: [
      { id: "opt_size", title: "Size", values: [{ value: "S" }, { value: "M" }] },
    ],
    variants: [variant(S, "S"), variant(M, "M")],
  }) as never

let container: HTMLDivElement
let root: Root

const render = async () => {
  const { default: ProductActions } = await import(
    "@modules/products/components/product-actions"
  )
  await act(async () => {
    root.render(
      createElement(ProductActions, { product: product(), region: { id: "reg_th" } as never })
    )
  })
}

const sizeInput = (size: string) =>
  container.querySelector<HTMLInputElement>(
    `[data-testid="product-options"] input[value="${size}"]`
  )!
const postedVariant = () =>
  container.querySelector<HTMLInputElement>('input[name="variant_id"]')!.value

describe("CORE-25: option บน PDP ไม่ถูกรีเซ็ตจาก v_id (กฎข้อ 78)", () => {
  beforeEach(() => {
    router.replace.mockReset()
    addToCart.mockReset().mockResolvedValue(undefined)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    window.history.replaceState(null, "", "/")
  })

  it("เปิด PDP ด้วย ?v_id=M → เลือก M (ใช้ v_id ตอนโหลด)", async () => {
    window.history.replaceState(null, "", `/th/products/t-shirt?v_id=${M}`)
    await render()
    expect(sizeInput("M").checked).toBe(true)
    expect(postedVariant()).toBe(M)
  })

  it("URL ยังเป็น v_id=S ขณะเลือก M แล้ว product.variants เปลี่ยน reference (RSC refresh) → ยังเป็น M", async () => {
    window.history.replaceState(null, "", `/th/products/t-shirt?v_id=${S}`)
    await render()
    expect(sizeInput("S").checked).toBe(true)

    await act(async () => sizeInput("M").click())
    expect(sizeInput("M").checked).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith(`/th/products/t-shirt?v_id=${M}`)

    // RSC refresh ส่ง product object ใหม่มาก่อน router.replace ของ M จะ commit URL
    await render()
    expect(sizeInput("M").checked, "ตัวเลือก M ต้องไม่ถูกรีเซ็ตเป็น S").toBe(true)
    expect(postedVariant()).toBe(M)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-product-button"]')!.click()
    })
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ variantId: M }))
  })
})
