// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OUT_OF_STOCK } from "@lib/util/checkout-error"
import { INSUFFICIENT_INVENTORY_MESSAGE } from "@lib/util/insufficient-inventory"
import { PROMPTPAY_FALLBACK_MAX_REQUESTS, PROMPTPAY_POLL_MS } from "@lib/util/payment-session"
import { CART_COMPLETION_IN_PROGRESS, PROCESSING_NOTICE } from "@lib/util/place-order-outcome"

// CORE-76 (spec 01 กฎข้อ 134, AC-175): ปุ่มยืนยันคำสั่งซื้อแสดงผลจาก kind ของ placeOrder (ไม่ใช่การเทียบข้อความ)
// (a) manual + สต็อกไม่พอ → INSUFFICIENT_INVENTORY_MESSAGE; (a2) processing → checkout-processing-notice แล้วอ่านซ้ำทุก
// PROMPTPAY_POLL_MS (กลไกเดียวกับ PAY-6b); unauthorized → หน้า login `/<cc>/account` (ไม่มี return_to — กฎข้อ 134 a2; บัตร + notice ตาม CORE-95)
const placeOrder = vi.fn()
const confirmPayment = vi.fn()
const push = vi.fn()

vi.mock("next/navigation", () => ({ useParams: () => ({ countryCode: "th" }), useRouter: () => ({ push }) }))
vi.mock("@lib/data/cart", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a) }))
vi.mock("@lib/util/checkout-affiliate", () => ({
  syncAffiliateBefore: (_cart: unknown, step: () => Promise<unknown>) => step(),
}))
vi.mock("@stripe/react-stripe-js", () => ({
  useStripe: () => ({ confirmPayment: (...a: unknown[]) => confirmPayment(...a) }),
  useElements: () => ({}),
}))
vi.mock("@modules/checkout/components/promptpay-payment", () => ({ default: () => null }))
vi.mock("@modules/common/components/localized-client-link", () => ({
  default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const CARD = "pp_stripe_stripe"
const MANUAL = "pp_system_default"

describe("ปุ่มยืนยันคำสั่งซื้อ: notice จาก kind (CORE-76)", () => {
  let container: HTMLDivElement
  let root: Root
  const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const cart = (provider: string) => ({
    id: "cart_1",
    email: "a@example.com",
    metadata: null,
    shipping_address: { first_name: "ก" },
    billing_address: { first_name: "ก", last_name: "ข" },
    payment_collection: { payment_sessions: [{ provider_id: provider }] },
  })

  const renderAndSubmit = async (provider: string) => {
    const { default: PaymentButton } = await import("@modules/checkout/components/payment-button")
    await act(async () => {
      root.render(
        createElement(PaymentButton, { cart: cart(provider) as never, deliveryDone: true, "data-testid": "submit-order-button" })
      )
    })
    await act(async () => {
      byTestId("submit-order-button")!.click()
    })
  }

  const tick = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(PROMPTPAY_POLL_MS)
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: false })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    confirmPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it("manual + สต็อกไม่พอ → INSUFFICIENT_INVENTORY_MESSAGE ไม่มีคำ คืนเงิน", async () => {
    placeOrder.mockResolvedValueOnce({ kind: "refunded", code: OUT_OF_STOCK })
    await renderAndSubmit(MANUAL)
    expect(byTestId("manual-payment-error-message")?.textContent).toBe(INSUFFICIENT_INVENTORY_MESSAGE)
    expect(byTestId("checkout-refunded-notice")).toBeNull()
    expect(container.textContent).not.toContain("คืนเงิน")
  })

  it.each([CARD, MANUAL])("%s: processing → checkout-processing-notice แล้วอ่านซ้ำด้วย placeOrder (ปุ่มยังกดไม่ได้)", async (provider) => {
    placeOrder.mockResolvedValueOnce({ kind: "processing" })
    placeOrder.mockReturnValueOnce(new Promise(() => {})) // รอบถัดไป: ได้ order = redirect ของ Next (ไม่ resolve ใน test)
    await renderAndSubmit(provider)
    expect(byTestId("checkout-processing-notice")?.textContent).toBe(PROCESSING_NOTICE)
    expect(byTestId("checkout-refunded-notice")).toBeNull()
    expect(byTestId("submit-order-button")).toHaveProperty("disabled", true)
    expect(placeOrder).toHaveBeenCalledTimes(1)

    await tick()
    expect(placeOrder).toHaveBeenCalledTimes(2)
    expect(placeOrder).toHaveBeenLastCalledWith("cart_1", undefined, "th")
  })

  it("บัตร: processing ครบเพดานทางสำรอง → promptpay-order-delayed (ได้รับเงินแล้ว ติดต่อร้าน) หยุดอ่าน", async () => {
    placeOrder.mockResolvedValue({ kind: "processing" })
    await renderAndSubmit(CARD)
    for (let i = 0; i < PROMPTPAY_FALLBACK_MAX_REQUESTS + 2; i++) await tick()
    expect(placeOrder).toHaveBeenCalledTimes(PROMPTPAY_FALLBACK_MAX_REQUESTS)
    expect(byTestId("promptpay-order-delayed")).not.toBeNull()
    expect(byTestId("checkout-processing-notice")).toBeNull()
  })

  it("manual: processing ครบเพดาน → ข้อความ fallback เดิม (ไม่บอกว่าได้รับเงิน)", async () => {
    placeOrder.mockResolvedValue({ kind: "processing" })
    await renderAndSubmit(MANUAL)
    for (let i = 0; i < PROMPTPAY_FALLBACK_MAX_REQUESTS + 2; i++) await tick()
    expect(placeOrder).toHaveBeenCalledTimes(PROMPTPAY_FALLBACK_MAX_REQUESTS)
    expect(byTestId("promptpay-order-delayed")).toBeNull()
    expect(byTestId("manual-payment-error-message")?.textContent).toBe("ยืนยันคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
  })

  it("processing แล้วรอบถัดไปได้ refunded (บัตร) → checkout-refunded-notice หยุดอ่าน", async () => {
    placeOrder.mockResolvedValueOnce({ kind: "processing" })
    placeOrder.mockResolvedValueOnce({ kind: "refunded", code: "FLASH_SOLD_OUT" })
    await renderAndSubmit(CARD)
    await tick()
    expect(byTestId("checkout-refunded-notice")).not.toBeNull()
    expect(byTestId("checkout-processing-notice")).toBeNull()
    await tick()
    expect(placeOrder).toHaveBeenCalledTimes(2)
  })

  // CORE-95 (กฎข้อ 151): บัตรที่ตัดเงินแล้ว → หน้า login พร้อม notice=payment_received; manual คงเดิม
  it.each([
    [CARD, "/th/account?notice=payment_received"],
    [MANUAL, "/th/account"],
  ])("%s: unauthorized → ไปหน้า login %s ไม่มี notice คืนเงิน", async (provider, path) => {
    placeOrder.mockResolvedValueOnce({ kind: "unauthorized" })
    await renderAndSubmit(provider)
    expect(push).toHaveBeenCalledWith(path)
    expect(byTestId("checkout-refunded-notice")).toBeNull()
  })
})

describe("static/contract (CORE-76)", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), "utf8")

  it("ปุ่มไม่ตัดสิน notice จากการเทียบข้อความ (ไม่มี === REFUNDED_NOTICE)", () => {
    const source = read("modules/checkout/components/payment-button/index.tsx")
    expect(source).not.toMatch(/===\s*REFUNDED_NOTICE/)
    expect(source).not.toMatch(/REFUNDED_NOTICE\s*===/)
  })

  // code ต้องตรงกับ backend (`api/store/carts/errors.ts`) ซึ่งมี contract test ข้อความกับ source ของ @medusajs/medusa อีกชั้น
  // CORE-82 (กฎข้อ 140, ADR-028): storefront ตัดสินจาก code อย่างเดียว — ไม่เก็บข้อความของ backend
  it("CART_COMPLETION_IN_PROGRESS ตรงกับ code ของ backend", () => {
    const backend = read("../../backend/src/api/store/carts/errors.ts")
    const value = (name: string) => backend.match(new RegExp(`export const ${name} = "([^"]+)"`))?.[1]
    expect(CART_COMPLETION_IN_PROGRESS).toBe(value("CART_COMPLETION_IN_PROGRESS"))
  })
})
