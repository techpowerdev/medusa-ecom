// @vitest-environment jsdom
import { FetchError } from "@medusajs/js-sdk"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHECKOUT_CONFLICTS, OUT_OF_STOCK, REFUNDED_NOTICE } from "@lib/util/checkout-error"
import { isOutOfStockAtCompletion } from "@lib/util/insufficient-inventory"
import { PROMOTION_REFUNDED_NOTICE } from "@lib/util/place-order-outcome"

// FS-22 (spec 03 กฎข้อ 27, AC-29): complete cart ล้มหลังตัดเงินด้วยเหตุโควตา/สต็อกหมด → `checkout-refunded-notice`
// "คืนเงินเต็มจำนวนอัตโนมัติ" แทน "ลองใหม่" — เฉพาะทางที่เงินถูกตัดแล้วจริง (บัตร: placeOrder หลัง PaymentIntent succeeded)
// manual payment ไม่มีการตัดเงิน → ข้อความเดิมของ code; error อื่น → ข้อความเดิม
const THAI = /[฀-๿]/
const text = (code: string) => CHECKOUT_CONFLICTS.find((c) => c.code === code)!.text
// ข้อความของ inventory module 2.22.1 (`ensureInventoryAvailability`) ตอน reserveInventoryStep ของ completeCartWorkflow
const NOT_ENOUGH = "Not enough stock available for item iitem_01ABC at location sloc_01XYZ"

const placeOrder = vi.fn()
const confirmPayment = vi.fn()

vi.mock("next/navigation", () => ({ useParams: () => ({ countryCode: "th" }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@lib/data/cart", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a) }))
vi.mock("@lib/util/checkout-affiliate", () => ({
  syncAffiliateBefore: (_cart: unknown, step: () => Promise<unknown>) => step(),
}))
vi.mock("@stripe/react-stripe-js", () => ({
  useStripe: () => ({ confirmPayment: (...a: unknown[]) => confirmPayment(...a) }),
  useElements: () => ({}),
}))
vi.mock("@modules/checkout/components/promptpay-payment", () => ({ default: () => null }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const payButton = () => import("@modules/checkout/components/payment-button")

describe("isOutOfStockAtCompletion (สต็อก inventory ไม่พอตอน complete)", () => {
  it.each([
    ["400 ข้อความ reserveInventory ของ Medusa", { status: 400, message: NOT_ENOUGH }],
    ["FetchError ของ js-sdk", new FetchError(NOT_ENOUGH, "Bad Request", 400)],
    ["400 insufficient_inventory (confirmInventory)", { status: 400, message: "Some variant does not have the required inventory" }],
  ])("%s → true", (_label, error) => {
    expect(isOutOfStockAtCompletion(error)).toBe(true)
  })

  it.each([
    ["409 ข้อความเดียวกัน", { status: 409, message: NOT_ENOUGH }],
    ["400 ข้อความอื่น", { status: 400, message: "Payment sessions are required" }],
    ["null", null],
    ["string", NOT_ENOUGH],
  ])("%s → false", (_label, error) => {
    expect(isOutOfStockAtCompletion(error)).toBe(false)
  })
})

describe("ข้อความ checkout-refunded-notice", () => {
  it("อักษรไทย มีคำว่า คืนเงิน ไม่มี ลองใหม่", () => {
    expect(REFUNDED_NOTICE).toMatch(THAI)
    expect(REFUNDED_NOTICE).toContain("คืนเงิน")
    expect(REFUNDED_NOTICE).not.toContain("ลองใหม่")
    expect(REFUNDED_NOTICE).not.toMatch(/[A-Za-z]/)
  })
})

// CORE-76 (spec 01 กฎข้อ 134 a2): การจัดผล → kind/ข้อความย้ายไป pure helper `placeOrderOutcome`/`checkoutNotice`
// (`lib/util/place-order-outcome.test.ts`) — placeOrder คืน `{ kind }` ปุ่มแสดง notice จาก kind
describe("ปุ่มยืนยันคำสั่งซื้อในขั้น review", () => {
  let container: HTMLDivElement
  let root: Root
  const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const cart = (provider: string) => ({
    id: "cart_1",
    email: "a@example.com",
    shipping_address: { first_name: "ก" },
    billing_address: { first_name: "ก", last_name: "ข" },
    payment_collection: { payment_sessions: [{ provider_id: provider }] },
  })

  const renderAndSubmit = async (provider: string) => {
    const { default: PaymentButton } = await payButton()
    await act(async () => {
      root.render(
        createElement(PaymentButton, { cart: cart(provider) as never, deliveryDone: true, "data-testid": "submit-order-button" })
      )
    })
    await act(async () => {
      byTestId("submit-order-button")!.click()
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    confirmPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it.each(["FLASH_LIMIT_EXCEEDED", "FLASH_SOLD_OUT", OUT_OF_STOCK])(
    "บัตร: complete ล้ม %s → checkout-refunded-notice ไม่มี error ลองใหม่",
    async (code) => {
      placeOrder.mockResolvedValueOnce({ kind: "refunded", code })
      await renderAndSubmit("pp_stripe_stripe")
      expect(byTestId("checkout-refunded-notice")?.textContent).toBe(REFUNDED_NOTICE)
      expect(byTestId("stripe-payment-error-message")).toBeNull()
      expect(container.textContent).not.toContain("ลองใหม่")
    }
  )

  // CORE-76 (session หลักตัดสิน 2026-11-21): PROMOTION_NOT_COMBINABLE หลังตัดบัตรเป็น kind refunded แต่ใช้ข้อความของตัวเอง
  it("บัตร: PROMOTION_NOT_COMBINABLE → checkout-refunded-notice ข้อความคืนเงินของโปรโมชัน", async () => {
    placeOrder.mockResolvedValueOnce({ kind: "refunded", code: "PROMOTION_NOT_COMBINABLE" })
    await renderAndSubmit("pp_stripe_stripe")
    expect(byTestId("checkout-refunded-notice")?.textContent).toBe(PROMOTION_REFUNDED_NOTICE)
    expect(byTestId("stripe-payment-error-message")).toBeNull()
  })

  it("บัตร: error อื่น → stripe-payment-error-message เดิม ไม่มี notice", async () => {
    placeOrder.mockResolvedValueOnce({ kind: "failed" })
    await renderAndSubmit("pp_stripe_stripe")
    expect(byTestId("checkout-refunded-notice")).toBeNull()
    expect(byTestId("stripe-payment-error-message")?.textContent).toMatch(THAI)
  })

  it("manual: FLASH_SOLD_OUT → ข้อความเดิมของ code ไม่มี notice (ไม่มีการตัดเงิน)", async () => {
    placeOrder.mockResolvedValueOnce({ kind: "refunded", code: "FLASH_SOLD_OUT" })
    await renderAndSubmit("pp_system_default")
    expect(byTestId("checkout-refunded-notice")).toBeNull()
    expect(byTestId("manual-payment-error-message")?.textContent).toBe(text("FLASH_SOLD_OUT"))
  })
})
