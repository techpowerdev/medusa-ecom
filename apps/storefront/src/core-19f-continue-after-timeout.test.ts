// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-19f (spec 01 กฎข้อ 75 b, AC-113): หลังปุ่ม Continue ปลดล็อกจาก timeout (กฎข้อ 71) กด Continue ขณะ prop `cart`
// ยังไม่มี session ของ provider ที่เลือก → สร้าง session ใหม่ และไม่ไปขั้น review (ส่วนการชำระเงินจะว่าง)
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const CARD = "pp_stripe_stripe"

const refresh = vi.fn()
const push = vi.fn()
// useRouter ของ Next คืน instance เดิมทุก render — mock ให้เหมือนกัน
const router = { refresh, push }
const initiatePaymentSession = vi.fn()
// step ปัจจุบันใน URL — test ของ nit review #310 เปลี่ยนเป็นขั้นอื่นระหว่างรอ session
const search = { value: "step=payment" }

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/th/checkout",
  useSearchParams: () => new URLSearchParams(search.value),
}))
vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: (...a: unknown[]) => initiatePaymentSession(...a),
}))
vi.mock("@modules/checkout/components/payment-container", () => ({
  default: () => null,
  StripePaymentContainer: () => null,
}))
vi.mock("@headlessui/react", async () => {
  const { createElement: h } = await import("react")
  return {
    RadioGroup: ({ onChange }: { onChange: (v: string) => void }) =>
      h(
        "div",
        null,
        h("button", { "data-testid": "select-promptpay", onClick: () => onChange(PROMPTPAY) }),
        h("button", { "data-testid": "select-card", onClick: () => onChange(CARD) })
      ),
  }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cartWith = (sessions: { provider_id: string; status: string }[]) =>
  ({
    id: "cart_1",
    total: 100,
    shipping_methods: [{ id: "sm_1" }],
    payment_collection: { id: "pay_col_1", payment_sessions: sessions },
  }) as never

let container: HTMLDivElement
let root: Root

const render = async (cart: unknown) => {
  const { default: Payment } = await import("@modules/checkout/components/payment")
  await act(async () => {
    root.render(
      createElement(Payment, {
        cart: cart as never,
        availablePaymentMethods: [{ id: PROMPTPAY }],
        deliveryDone: true,
      })
    )
  })
}

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const submit = () => byTestId("submit-payment-button") as HTMLButtonElement
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe("CORE-19f: Continue หลังปลดล็อกจาก timeout ไม่ข้าม session (กฎข้อ 75 b)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockReset()
    push.mockReset()
    search.value = "step=payment"
    initiatePaymentSession.mockReset().mockResolvedValue({ ok: true })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it.each([
    ["cart ไม่มี session เลย", cartWith([])],
    ["cart ยังมีแต่ session บัตรเดิม", cartWith([{ provider_id: CARD, status: "pending" }])],
  ])("%s → กด Continue สร้าง session ใหม่ ไม่ไปขั้น review และล็อกรอ session อีกรอบ", async (_label, cart) => {
    await render(cart)
    await act(async () => {
      byTestId("select-promptpay")!.click()
    })
    await advance(10_000)
    expect(submit().disabled).toBe(false)
    expect(byTestId("payment-session-pending-error")).not.toBeNull()

    await act(async () => {
      submit().click()
    })

    expect(initiatePaymentSession).toHaveBeenCalledTimes(2)
    expect(initiatePaymentSession).toHaveBeenLastCalledWith(cart, { provider_id: PROMPTPAY })
    expect(push).not.toHaveBeenCalled()
    // ล็อกรอ session ของ provider นี้อีกรอบ (กฎข้อ 71: refresh 5 วินาที / ปลดล็อก 10 วินาที)
    expect(submit().disabled).toBe(true)
    await advance(5_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(push).not.toHaveBeenCalled()
  })

  it("Continue ที่สร้าง session ใหม่ → ไปขั้น review 1 ครั้งเมื่อ cart ใน props มี session นั้นแล้ว", async () => {
    await render(cartWith([]))
    await act(async () => {
      byTestId("select-promptpay")!.click()
    })
    await advance(10_000)
    await act(async () => {
      submit().click()
    })
    expect(push).not.toHaveBeenCalled()

    await render(cartWith([{ provider_id: PROMPTPAY, status: "pending" }]))
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/th/checkout?step=review", { scroll: false })
    await render(cartWith([{ provider_id: PROMPTPAY, status: "pending" }]))
    expect(push).toHaveBeenCalledTimes(1)
  })

  it("ล็อกรอบสองก็ timeout → ปลดล็อก + error ไทย และไม่ไปขั้น review แม้ cart ได้ session ทีหลัง", async () => {
    await render(cartWith([]))
    await act(async () => {
      byTestId("select-promptpay")!.click()
    })
    await advance(10_000)
    await act(async () => {
      submit().click()
    })
    await advance(10_000)
    expect(submit().disabled).toBe(false)
    expect(byTestId("payment-session-pending-error")).not.toBeNull()

    await render(cartWith([{ provider_id: PROMPTPAY, status: "pending" }]))
    expect(push).not.toHaveBeenCalled()
  })

  it("cart มี session ของ provider ที่เลือกแล้ว → Continue ไปขั้น review โดยไม่สร้างซ้ำ (AC-64 คงเดิม)", async () => {
    await render(cartWith([{ provider_id: PROMPTPAY, status: "pending" }]))
    await act(async () => {
      submit().click()
    })
    expect(initiatePaymentSession).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/th/checkout?step=review", { scroll: false })
  })

  // ปลดล็อกจาก timeout แล้วกด Continue → รอ session พร้อมเพย์ (ตั้งใจไป review เมื่อ session มา)
  const continueAfterTimeout = async () => {
    await render(cartWith([]))
    await act(async () => {
      byTestId("select-promptpay")!.click()
    })
    await advance(10_000)
    await act(async () => {
      submit().click()
    })
    expect(push).not.toHaveBeenCalled()
  }

  it("กด Continue แล้วเปลี่ยนวิธีชำระระหว่างรอ → session ของวิธีใหม่มาถึงไม่ไปขั้น review เอง (review #310)", async () => {
    await continueAfterTimeout()
    await act(async () => {
      byTestId("select-card")!.click()
    })
    await render(cartWith([{ provider_id: CARD, status: "pending" }]))
    expect(push).not.toHaveBeenCalled()
  })

  it("กด Continue แล้วลูกค้ากลับไปแก้ขั้นอื่นระหว่างรอ → session มาถึงไม่ดึงไปขั้น review (review #310)", async () => {
    await continueAfterTimeout()
    search.value = "step=delivery"
    await render(cartWith([{ provider_id: PROMPTPAY, status: "pending" }]))
    expect(push).not.toHaveBeenCalled()
  })
})
