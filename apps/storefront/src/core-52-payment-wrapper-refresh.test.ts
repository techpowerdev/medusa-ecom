// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-52 (review #353 รอบ 3): หน้า checkout อ่าน cart แบบ fresh (กฎข้อ 110a) — หลัง guard ของ backend (PAY-6b) authorize
// session พร้อมเพย์แล้ว `router.refresh()` ได้ session สถานะ `authorized` ไม่ใช่ `pending`; PaymentWrapper ต้องไม่สลับจาก
// StripeWrapper เป็น `<div>` (React mount children ใหม่ → state คืนเงิน/รอ order ของ promptpay-payment หาย — CI AC-17)
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => createElement("div", { "data-testid": "elements" }, children),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PROMPTPAY = "pp_stripe-promptpay_stripe"
const session = (status: string, provider_id = PROMPTPAY) =>
  ({ id: "ps_1", provider_id, status, data: { client_secret: "pi_1_secret" } }) as never

// แทน promptpay-payment: state ภายในที่ต้องอยู่รอดหลัง refresh
const Child = () => {
  const [mountedAt] = useState(() => Math.random())
  return createElement("span", { "data-testid": "child", "data-mounted": String(mountedAt) })
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_STRIPE_KEY", "pk_test_dummy")
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllEnvs()
})

const render = async (paymentSessions: unknown[]) => {
  const { default: PaymentWrapper } = await import("@modules/checkout/components/payment-wrapper")
  await act(async () => {
    root.render(createElement(PaymentWrapper, { paymentSessions } as never, createElement(Child)))
  })
}
const mounted = () => container.querySelector('[data-testid="child"]')!.getAttribute("data-mounted")

describe("PaymentWrapper หลัง session พร้อมเพย์ถูก authorize (review #353)", () => {
  it("pending → authorized: ยังอยู่ใน Elements และไม่ mount children ใหม่", async () => {
    await render([session("pending")])
    const before = mounted()
    expect(container.querySelector('[data-testid="elements"]')).not.toBeNull()

    await render([session("authorized")])

    expect(container.querySelector('[data-testid="elements"]')).not.toBeNull()
    expect(mounted()).toBe(before)
  })

  it("session บัตรที่ authorized แล้วไม่ถูกเลือก (คงพฤติกรรมเดิม — ไม่มี Elements)", async () => {
    await render([session("authorized", "pp_stripe_stripe")])
    expect(container.querySelector('[data-testid="elements"]')).toBeNull()
  })
})
