// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHECKOUT_CONFLICTS } from "@lib/util/checkout-error"
import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import type { GroupBuyOrder } from "@lib/util/order-pay"

// CORE-4i-b (spec 01 กฎข้อ 72, AC-110): ผู้เรียก action ชำระเงินใน checkout และหน้า /account/orders/:id/pay อ่านผลที่คืน
// — `unauthorized` แสดง SIGN_IN_AGAIN_MESSAGE, action ที่ reject เอง (request ของ action ล้ม) = `failed` → ข้อความ fallback ไทย
const CARD = "pp_stripe_stripe"
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const THAI = /[฀-๿]/
const SOLD_OUT = CHECKOUT_CONFLICTS.find((c) => c.code === "FLASH_SOLD_OUT")!
const REJECTED = new Error("An error occurred in the Server Components render")

const initiatePaymentSession = vi.fn()
const renewPromptPaySession = vi.fn()
const placeOrder = vi.fn()
const setShippingMethod = vi.fn()
const startPaymentSession = vi.fn()
const retrieveGroupBuyOrder = vi.fn()
const refresh = vi.fn()
const router = { refresh, push: vi.fn(), replace: vi.fn() }

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/th/checkout",
  useSearchParams: () => new URLSearchParams("step=payment"),
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: (...a: unknown[]) => initiatePaymentSession(...a),
  renewPromptPaySession: (...a: unknown[]) => renewPromptPaySession(...a),
  placeOrder: (...a: unknown[]) => placeOrder(...a),
  setShippingMethod: (...a: unknown[]) => setShippingMethod(...a),
  getPromptPayState: vi.fn(),
}))
vi.mock("@lib/data/payment", () => ({
  startPaymentSession: (...a: unknown[]) => startPaymentSession(...a),
}))
vi.mock("@lib/data/group-buy", () => ({
  retrieveGroupBuyOrder: (...a: unknown[]) => retrieveGroupBuyOrder(...a),
}))
vi.mock("@lib/data/fulfillment", () => ({ calculatePriceForShippingOption: vi.fn() }))
vi.mock("@modules/checkout/components/payment-container", () => ({
  default: () => null,
  StripePaymentContainer: () => null,
}))
vi.mock("@modules/checkout/components/payment-wrapper", () => ({
  default: ({ children }: { children: unknown }) => children,
}))
vi.mock("@modules/order/components/order-pay/pay-buttons", () => ({
  OrderCardButton: () => null,
  OrderPromptPayButton: () => null,
}))
// RadioGroup ของ headlessui → ปุ่มที่เลือกวิธีชำระ (`data-provider` ของ test กำหนดผ่าน `selectProvider`)
const selectProvider = { value: CARD }
vi.mock("@headlessui/react", async () => {
  const { createElement: h } = await import("react")
  return {
    Radio: () => null,
    RadioGroup: ({ onChange }: { onChange: (v: string) => void }) =>
      h("button", { "data-testid": "select-provider", onClick: () => onChange(selectProvider.value) }),
  }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => {
    byTestId(id)!.click()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("checkout ขั้นชำระเงิน (Payment) อ่านผลของ initiatePaymentSession", () => {
  const cart = { id: "cart_1", total: 100, shipping_methods: [{ id: "sm_1" }], payment_collection: { payment_sessions: [] } }

  const render = async () => {
    const { default: Payment } = await import("@modules/checkout/components/payment")
    await act(async () => {
      root.render(
        createElement(Payment, { cart: cart as never, availablePaymentMethods: [{ id: PROMPTPAY }], deliveryDone: true })
      )
    })
  }

  beforeEach(() => {
    selectProvider.value = PROMPTPAY
  })

  it("เลือกวิธีชำระ → unauthorized แสดง SIGN_IN_AGAIN_MESSAGE", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "unauthorized" })
    await render()
    await click("select-provider")
    expect(byTestId("payment-method-error-message")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("เลือกวิธีชำระ → failed กับ action reject ได้ข้อความ fallback ไทยเดียวกัน", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("select-provider")
    const failed = byTestId("payment-method-error-message")?.textContent
    expect(failed).toMatch(THAI)
    expect(failed).not.toBe(SIGN_IN_AGAIN_MESSAGE)

    initiatePaymentSession.mockRejectedValueOnce(REJECTED)
    await click("select-provider")
    expect(byTestId("payment-method-error-message")?.textContent).toBe(failed)
  })

  it("กด Continue → ผลล้มไม่ไปขั้น review และแสดง SIGN_IN_AGAIN_MESSAGE เมื่อ unauthorized", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("select-provider")
    initiatePaymentSession.mockResolvedValueOnce({ error: "unauthorized" })
    await click("submit-payment-button")
    expect(initiatePaymentSession).toHaveBeenCalledTimes(2)
    expect(byTestId("payment-method-error-message")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(router.push).not.toHaveBeenCalled()
  })

  it("กด Continue → สร้าง session สำเร็จ → ไปขั้น review", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "failed" })
    await render()
    await click("select-provider")
    initiatePaymentSession.mockResolvedValueOnce({ ok: true })
    await click("submit-payment-button")
    expect(router.push).toHaveBeenCalledWith("/th/checkout?step=review", { scroll: false })
  })
})

describe("ปุ่มยืนยันคำสั่งซื้อ (completeOrder) อ่านผลของ placeOrder", () => {
  const complete = async () => (await import("@modules/checkout/components/payment-button")).completeOrder(placeOrder())

  it("unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    placeOrder.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(complete()).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("FLASH_SOLD_OUT → ข้อความไทยของ code นั้น", async () => {
    placeOrder.mockResolvedValueOnce({ error: "FLASH_SOLD_OUT" })
    await expect(complete()).resolves.toBe(SOLD_OUT.text)
  })

  it("failed กับ action reject ได้ข้อความ fallback ไทยเดียวกัน", async () => {
    placeOrder.mockResolvedValueOnce({ error: "failed" })
    const failed = await complete()
    placeOrder.mockRejectedValueOnce(REJECTED)
    await expect(complete()).resolves.toBe(failed)
    expect(failed).toMatch(THAI)
  })

  it("redirect ไปหน้า confirmed (action ไม่คืนค่า) → null", async () => {
    placeOrder.mockResolvedValueOnce(undefined)
    await expect(complete()).resolves.toBeNull()
  })
})

describe("ขั้น delivery (selectShippingMethod) อ่านผลของ setShippingMethod", () => {
  const choose = async () => (await import("@modules/checkout/components/shipping")).selectShippingMethod("cart_1", "so_1")

  it("ok → null; unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    setShippingMethod.mockResolvedValueOnce({ ok: true })
    await expect(choose()).resolves.toBeNull()
    setShippingMethod.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(choose()).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("failed กับ action reject ได้ข้อความ fallback ไทยเดียวกัน", async () => {
    setShippingMethod.mockResolvedValueOnce({ error: "failed" })
    const failed = await choose()
    setShippingMethod.mockRejectedValueOnce(REJECTED)
    await expect(choose()).resolves.toBe(failed)
    expect(failed).toMatch(THAI)
  })
})

describe("QR พร้อมเพย์หมดอายุ (renewPromptPayQr) อ่านผลของ renewPromptPaySession", () => {
  const renew = async () =>
    (await import("@modules/checkout/components/promptpay-payment")).renewPromptPayQr({ id: "cart_1" } as never, PROMPTPAY)

  it("ok → renewed; PAYMENT_ALREADY_COMPLETED → already-paid", async () => {
    renewPromptPaySession.mockResolvedValueOnce({ ok: true })
    await expect(renew()).resolves.toEqual({ status: "renewed" })
    renewPromptPaySession.mockResolvedValueOnce({ error: "PAYMENT_ALREADY_COMPLETED" })
    await expect(renew()).resolves.toEqual({ status: "already-paid" })
  })

  it("unauthorized → SIGN_IN_AGAIN_MESSAGE; failed/reject → ข้อความ fallback ไทย", async () => {
    renewPromptPaySession.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(renew()).resolves.toEqual({ status: "error", message: SIGN_IN_AGAIN_MESSAGE })
    renewPromptPaySession.mockResolvedValueOnce({ error: "failed" })
    const failed = await renew()
    renewPromptPaySession.mockRejectedValueOnce(REJECTED)
    await expect(renew()).resolves.toEqual(failed)
    expect(failed).toEqual({ status: "error", message: expect.stringMatching(THAI) })
  })
})

describe("หน้า /account/orders/:id/pay (OrderPay) อ่านผลของ startPaymentSession", () => {
  const LATER = new Date(Date.now() + 86_400_000).toISOString()
  const data = (payment_status = "not_paid", session?: string): GroupBuyOrder => ({
    membership: { id: "gbm_1", status: "awaiting_payment", units: 1 },
    group: { id: "gbg_1", status: "succeeded", ends_at: null, pay_deadline_at: LATER },
    order: {
      id: "order_1",
      display_id: 1,
      currency_code: "thb",
      total: 100,
      payment_status,
      items: [],
      payment_collections: [
        {
          id: "pay_col_1",
          amount: 100,
          status: "not_paid",
          payment_sessions: session
            ? [{ id: "payses_1", provider_id: CARD, status: session, amount: 100, data: {} }]
            : [],
        },
      ],
    },
  })

  const render = async () => {
    const { default: OrderPay } = await import("@modules/order/components/order-pay")
    await act(async () => {
      root.render(createElement(OrderPay, { initial: data(), email: "a@b.c", redirect: null, serverNow: Date.now() }))
    })
    await click("select-provider")
  }

  beforeEach(() => {
    selectProvider.value = CARD
  })

  it("unauthorized → SIGN_IN_AGAIN_MESSAGE + refresh (layout พาไป login) และไม่อ่าน GB-8", async () => {
    startPaymentSession.mockResolvedValueOnce({ error: "unauthorized" })
    await render()
    expect(startPaymentSession).toHaveBeenCalledWith("pay_col_1", CARD)
    expect(byTestId("order-pay-error")?.textContent).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(retrieveGroupBuyOrder).not.toHaveBeenCalled()
  })

  it("PAYMENT_ALREADY_COMPLETED → ทาง poll ของกฎข้อ 9(d) (order-pay-awaiting) ไม่มี error", async () => {
    startPaymentSession.mockResolvedValueOnce({ error: "PAYMENT_ALREADY_COMPLETED" })
    await render()
    expect(byTestId("order-pay-awaiting")).not.toBeNull()
    expect(byTestId("order-pay-error")).toBeNull()
  })

  it.each([
    ["failed", () => startPaymentSession.mockResolvedValueOnce({ error: "failed" })],
    ["action reject", () => startPaymentSession.mockRejectedValueOnce(REJECTED)],
  ])("%s → (d2) อ่าน GB-8 1 ครั้ง: ยังไม่ชำระ → order-pay-error ไทย", async (_label, arrange) => {
    arrange()
    retrieveGroupBuyOrder.mockResolvedValueOnce(data())
    await render()
    expect(retrieveGroupBuyOrder).toHaveBeenCalledTimes(1)
    expect(byTestId("order-pay-error")?.textContent).toMatch(THAI)
    expect(byTestId("order-pay-error")?.textContent).not.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("failed + GB-8 มีการชำระแล้ว → ทาง poll (d) ไม่มี error", async () => {
    startPaymentSession.mockResolvedValueOnce({ error: "failed" })
    retrieveGroupBuyOrder.mockResolvedValueOnce(data("not_paid", "authorized"))
    await render()
    expect(byTestId("order-pay-awaiting")).not.toBeNull()
    expect(byTestId("order-pay-error")).toBeNull()
  })

  it("ok → อ่าน GB-8 ใหม่ ไม่มี error", async () => {
    startPaymentSession.mockResolvedValueOnce({ ok: true })
    retrieveGroupBuyOrder.mockResolvedValueOnce(data("not_paid", "pending"))
    await render()
    expect(retrieveGroupBuyOrder).toHaveBeenCalledTimes(1)
    expect(byTestId("order-pay-error")).toBeNull()
  })
})
