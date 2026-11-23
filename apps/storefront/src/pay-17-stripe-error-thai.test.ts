// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { STRIPE_CARD_DECLINED } from "@lib/util/stripe-error"

// PAY-17 (spec 06 กฎข้อ 19a, AC-30a): StripePaymentButton ขั้น review — confirmPayment คืน error ข้อความอังกฤษของ Stripe
// → `stripe-payment-error-message` เป็นข้อความไทย (ไม่แสดง `error.message` ตรง)
const THAI = /[฀-๿]/
const DECLINED_EN = "Your card was declined."

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

describe("StripePaymentButton: error ของ confirmPayment (AC-30a)", () => {
  let container: HTMLDivElement
  let root: Root
  const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const cart = {
    id: "cart_1",
    email: "a@example.com",
    shipping_address: { first_name: "ก" },
    billing_address: { first_name: "ก", last_name: "ข" },
    payment_collection: { payment_sessions: [{ provider_id: "pp_stripe_stripe" }] },
  }

  const renderAndSubmit = async () => {
    const { default: PaymentButton } = await import("@modules/checkout/components/payment-button")
    await act(async () => {
      root.render(createElement(PaymentButton, { cart: cart as never, deliveryDone: true, "data-testid": "submit-order-button" }))
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
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("card_error/card_declined ข้อความอังกฤษ → ข้อความไทยของบัตรถูกปฏิเสธ ไม่มีข้อความของ Stripe และไม่ complete cart", async () => {
    confirmPayment.mockResolvedValueOnce({
      error: { type: "card_error", code: "card_declined", decline_code: "generic_decline", message: DECLINED_EN },
    })
    await renderAndSubmit()
    const shown = byTestId("stripe-payment-error-message")
    expect(shown?.textContent).toContain(STRIPE_CARD_DECLINED)
    expect(shown?.textContent).toMatch(THAI)
    expect(container.textContent).not.toContain(DECLINED_EN)
    expect(placeOrder).not.toHaveBeenCalled()
    expect((byTestId("submit-order-button") as HTMLButtonElement).disabled).toBe(false)
  })

  it("error ไม่มี message → ยังแสดงข้อความไทย (ไม่เงียบ)", async () => {
    confirmPayment.mockResolvedValueOnce({ error: { type: "api_error" } })
    await renderAndSubmit()
    expect(byTestId("stripe-payment-error-message")?.textContent).toMatch(THAI)
  })
})
