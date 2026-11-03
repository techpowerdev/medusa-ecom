// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-27 (spec 01 กฎข้อ 83, AC-119): ปุ่มเพิ่มลงตะกร้าบน PDP (`add-product-button` + `mobile-cart-button`) ต้องกันการยิงซ้อน
// แบบ synchronous — คลิกสองครั้งใน `act()` เดียว (React ไม่ render ระหว่างคลิก จึง `isAdding` ยังไม่ทัน) → `addToCart` 1 ครั้ง
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
// หลัง FS-19 (#211) แถบมือถือ mount เฉพาะ `inView === false`
vi.mock("@lib/hooks/use-in-view", () => ({ useIntersection: () => false }))
vi.mock("@modules/products/components/flash-sale", () => ({
  default: () => null,
  FlashPrice: () => null,
  useFlashOffer: () => ({ offer: null, loading: false }),
}))
vi.mock("@modules/products/components/product-price", () => ({ default: () => null }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const product = () =>
  ({
    id: "prod_tshirt",
    options: [
      { id: "opt_size", title: "Size", values: [{ value: "S" }, { value: "M" }, { value: "L" }] },
    ],
    // "L" ไม่มี variant → เลือกแล้วตัวเลือกไม่ valid
    variants: [
      { id: "variant_s", manage_inventory: false, options: [{ option_id: "opt_size", value: "S" }] },
      { id: "variant_m", manage_inventory: false, options: [{ option_id: "opt_size", value: "M" }] },
    ],
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (props: { disabled?: boolean } = {}) => {
  const { default: ProductActions } = await import(
    "@modules/products/components/product-actions"
  )
  await act(async () => {
    root.render(
      createElement(ProductActions, {
        product: product(),
        region: { id: "reg_th" } as never,
        ...props,
      })
    )
  })
}

const button = (testid: string) =>
  document.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!

const mainButton = () => button("add-product-button")
const mobileButton = () => button("mobile-cart-button")

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("CORE-27: กันกดเพิ่มลงตะกร้าซ้อนบน PDP (กฎข้อ 83, AC-119)", () => {
  beforeEach(() => {
    router.replace.mockReset()
    addToCart.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    window.history.replaceState(null, "", "/")
  })

  it("คลิก add-product-button สองครั้งใน act() เดียว → addToCart 1 ครั้ง", async () => {
    addToCart.mockReturnValue(new Promise(() => {}))
    await render()
    expect(mainButton().disabled, "ปุ่มต้องกดได้ก่อนคลิก").toBe(false)

    act(() => {
      mainButton().click()
      mainButton().click()
    })
    expect(addToCart).toHaveBeenCalledTimes(1)
  })

  it("คลิก mobile-cart-button สองครั้งใน act() เดียว → addToCart 1 ครั้ง", async () => {
    addToCart.mockReturnValue(new Promise(() => {}))
    await render()
    expect(mobileButton().disabled, "ปุ่มมือถือต้องกดได้ก่อนคลิก").toBe(false)

    act(() => {
      mobileButton().click()
      mobileButton().click()
    })
    expect(addToCart).toHaveBeenCalledTimes(1)
  })

  it("คลิกปุ่มหลัก + ปุ่มมือถือสลับกันใน act() เดียว → addToCart 1 ครั้ง", async () => {
    addToCart.mockReturnValue(new Promise(() => {}))
    await render()
    expect(mainButton().disabled).toBe(false)
    expect(mobileButton().disabled).toBe(false)

    act(() => {
      mainButton().click()
      mobileButton().click()
      mainButton().click()
    })
    expect(addToCart).toHaveBeenCalledTimes(1)
  })

  it("request แรก resolve แล้วคลิกอีกครั้ง → เรียกครั้งที่ 2", async () => {
    const first = deferred()
    addToCart.mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    await render()
    expect(mainButton().disabled).toBe(false)

    act(() => {
      mainButton().click()
      mainButton().click()
    })
    expect(addToCart).toHaveBeenCalledTimes(1)

    await act(async () => first.resolve())
    expect(mainButton().disabled, "ปลดปุ่มหลัง request แรกจบ").toBe(false)
    await act(async () => mainButton().click())
    expect(addToCart).toHaveBeenCalledTimes(2)
  })

  it("request แรก reject → ปลด guard แล้วคลิกอีกครั้งได้", async () => {
    const first = deferred()
    addToCart.mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    await render()
    expect(mobileButton().disabled).toBe(false)

    act(() => {
      mobileButton().click()
      mobileButton().click()
    })
    expect(addToCart).toHaveBeenCalledTimes(1)

    await act(async () => first.reject(new Error("boom")))
    expect(button("add-to-cart-error")).not.toBeNull()
    expect(mobileButton().disabled).toBe(false)
    await act(async () => mobileButton().click())
    expect(addToCart).toHaveBeenCalledTimes(2)
  })

  it("ระหว่าง request ค้าง mobile-cart-button disabled (isAdding)", async () => {
    addToCart.mockReturnValue(new Promise(() => {}))
    await render()
    await act(async () => mainButton().click())
    expect(mobileButton().disabled).toBe(true)
  })

  it("prop disabled → mobile-cart-button มี attribute disabled", async () => {
    await render({ disabled: true })
    expect(mainButton().disabled).toBe(true)
    expect(mobileButton().hasAttribute("disabled")).toBe(true)
  })

  it("เลือก option ที่ไม่มี variant (ไม่ valid) → mobile-cart-button มี attribute disabled", async () => {
    await render()
    expect(mobileButton().disabled).toBe(false)
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('[data-testid="product-options"] input[value="L"]')!
        .click()
    )
    expect(mainButton().disabled).toBe(true)
    expect(mobileButton().hasAttribute("disabled")).toBe(true)
  })
})
