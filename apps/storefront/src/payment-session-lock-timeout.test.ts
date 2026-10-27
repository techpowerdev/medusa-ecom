// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-19e (spec 01 กฎข้อ 71, AC-107): ปุ่ม Continue ของขั้นชำระเงินที่ล็อกรอ session (CORE-19b) ต้องไม่ค้างถาวร
// เมื่อ RSC refresh ไม่มาถึง — 5 วินาที router.refresh() 1 ครั้ง, 10 วินาทีปลดล็อก + error ไทย
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const THAI = /[฀-๿]/

const refresh = vi.fn()
// useRouter ของ Next คืน instance เดิมทุก render — mock ให้เหมือนกัน
const router = { refresh, push: vi.fn() }
const initiatePaymentSession = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/th/checkout",
  useSearchParams: () => new URLSearchParams("step=payment"),
}))
vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: (...a: unknown[]) => initiatePaymentSession(...a),
}))
vi.mock("@modules/checkout/components/payment-container", () => ({
  default: () => null,
  StripePaymentContainer: () => null,
}))
// RadioGroup ของ headlessui → ปุ่มธรรมดาที่เลือก PromptPay (สิ่งที่ทดสอบคือการล็อกของปุ่ม Continue)
vi.mock("@headlessui/react", async () => {
  const { createElement: h } = await import("react")
  return {
    RadioGroup: ({ onChange }: { onChange: (v: string) => void }) =>
      h("button", { "data-testid": "select-promptpay", onClick: () => onChange(PROMPTPAY) }),
  }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cartWith = (sessions: { provider_id: string; status: string }[]) =>
  ({
    id: "cart_1",
    total: 100,
    shipping_methods: [{ id: "sm_1" }],
    payment_collection: { payment_sessions: sessions },
  }) as never

const noSession = cartWith([])
const withSession = cartWith([{ provider_id: PROMPTPAY, status: "pending" }])

let container: HTMLDivElement
let root: Root

const render = async (cart: unknown) => {
  const { default: Payment } = await import("@modules/checkout/components/payment")
  await act(async () => {
    root.render(
      createElement(Payment, {
        cart: cart as never,
        availablePaymentMethods: [{ id: PROMPTPAY }],
      })
    )
  })
}

const byTestId = (id: string) =>
  container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const submit = () => byTestId("submit-payment-button") as HTMLButtonElement

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe("CORE-19e: ปุ่ม Continue ที่ล็อกรอ session ไม่ค้างถาวร (กฎข้อ 71)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockReset()
    initiatePaymentSession.mockReset().mockResolvedValue(undefined)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  const lockWithoutSessionInProps = async () => {
    await render(noSession)
    await act(async () => {
      byTestId("select-promptpay")!.click()
    })
    expect(initiatePaymentSession).toHaveBeenCalledTimes(1)
    expect(submit().disabled).toBe(true)
  }

  it("5 วินาที → router.refresh 1 ครั้งและปุ่มยัง disabled; 10 วินาที → ปุ่มกดได้และเห็น error ไทย", async () => {
    await lockWithoutSessionInProps()

    await advance(4_999)
    expect(refresh).not.toHaveBeenCalled()

    await advance(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(submit().disabled).toBe(true)
    expect(byTestId("payment-session-pending-error")).toBeNull()

    await advance(5_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(submit().disabled).toBe(false)
    const error = byTestId("payment-session-pending-error")
    expect(error).not.toBeNull()
    expect(error!.textContent).toMatch(THAI)
  })

  it("cart ได้ session ที่ 2 วินาที → ปลดล็อกทันที ไม่ refresh และไม่มี error หลัง 10 วินาที", async () => {
    await lockWithoutSessionInProps()

    await advance(2_000)
    await render(withSession)
    expect(submit().disabled).toBe(false)

    await advance(10_000)
    expect(refresh).not.toHaveBeenCalled()
    expect(submit().disabled).toBe(false)
    expect(byTestId("payment-session-pending-error")).toBeNull()
  })
})
