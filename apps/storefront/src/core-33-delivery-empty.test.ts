// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DIGITAL_DELIVERY_TYPE_CODE } from "@lib/util/shipping-options"

// CORE-33 (spec 01 กฎข้อ 91, AC-127; qa #243 O-1/O-2): ขั้น delivery ของ checkout หลังกรองตามกฎข้อ 89
// (a) ไม่เหลือ option → ข้อความไทยใน delivery-options-empty, ไม่มี radio, ปุ่มไปชำระเงิน disabled
// (b) method ค้างที่ถูกกรองออกถือว่ายังไม่เลือก — ไม่ติ๊ก radio และสรุปตอนขั้นปิดไม่แสดงชื่อ/ราคาของ method นั้น
const THAI = /[฀-๿]/

const step = { value: "delivery" as string | null }
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => (k === "step" ? step.value : null) }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/th/checkout",
}))
vi.mock("@lib/data/cart", () => ({ setShippingMethod: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock("@lib/data/fulfillment", () => ({ calculatePriceForShippingOption: vi.fn() }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const standard = {
  id: "so_standard",
  name: "Standard",
  price_type: "flat",
  amount: 50,
  type: { code: "standard" },
}
const digital = {
  id: "so_digital",
  name: "Digital delivery",
  price_type: "flat",
  amount: 7,
  type: { code: DIGITAL_DELIVERY_TYPE_CODE },
}
const staleDigitalMethod = { id: "sm_1", shipping_option_id: digital.id, name: "Digital delivery", amount: 777 }

const cartWith = (shipping_methods: unknown[]) =>
  ({
    id: "cart_1",
    currency_code: "thb",
    items: [{ id: "item_1", requires_shipping: true }],
    shipping_methods,
    shipping_address: { address_1: "1" },
    billing_address: { address_1: "1" },
    email: "a@example.com",
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (cart: unknown, availableShippingMethods: unknown[]) => {
  const { default: Shipping } = await import("@modules/checkout/components/shipping")
  await act(async () => {
    root.render(createElement(Shipping, { cart, availableShippingMethods } as never))
  })
}

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const submitButton = () => byTestId("submit-delivery-option-button") as HTMLButtonElement

describe("CORE-33: ขั้น delivery หลังกรองวิธีส่ง (AC-127)", () => {
  beforeEach(() => {
    step.value = "delivery"
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("รายการมีแต่ Digital delivery กับ cart ที่ต้องจัดส่ง → delivery-options-empty ภาษาไทย ไม่มี radio ปุ่ม disabled", async () => {
    await render(cartWith([]), [digital])
    expect(byTestId("delivery-options-empty")?.textContent).toMatch(THAI)
    expect(container.querySelectorAll('[data-testid="delivery-option-radio"]')).toHaveLength(0)
    expect(container.querySelectorAll('[role="radio"]')).toHaveLength(0)
    expect(submitButton().disabled).toBe(true)
  })

  it("มี Standard ในรายการ → ไม่มี delivery-options-empty", async () => {
    await render(cartWith([]), [standard, digital])
    expect(byTestId("delivery-options-empty")).toBeNull()
    expect(container.querySelectorAll('[data-testid="delivery-option-radio"]')).toHaveLength(1)
  })

  it("cart ค้าง Digital delivery (ถูกกรองออก) → ไม่มี radio ที่ติ๊ก และปุ่ม disabled", async () => {
    await render(cartWith([staleDigitalMethod]), [standard, digital])
    const checked = container.querySelectorAll(
      '[data-testid="delivery-options-container"] [aria-checked="true"], [data-testid="delivery-options-container"] [data-checked]'
    )
    expect(checked).toHaveLength(0)
    expect(submitButton().disabled).toBe(true)
  })

  it("cart เลือก Standard ไว้ → radio ของ Standard ติ๊ก และปุ่ม enabled", async () => {
    await render(cartWith([{ id: "sm_2", shipping_option_id: standard.id, name: "Standard", amount: 50 }]), [standard])
    const radio = container.querySelector('[data-testid="delivery-option-radio"][data-option-id="so_standard"]')
    expect(radio?.getAttribute("aria-checked")).toBe("true")
    expect(submitButton().disabled).toBe(false)
  })

  it("ขั้นปิด + method ล่าสุดถูกกรองออก → สรุปไม่มีชื่อและราคาของ method นั้น", async () => {
    step.value = null
    await render(cartWith([staleDigitalMethod]), [standard, digital])
    expect(container.textContent).not.toContain(staleDigitalMethod.name)
    expect(container.textContent).not.toContain(String(staleDigitalMethod.amount))
  })
})
