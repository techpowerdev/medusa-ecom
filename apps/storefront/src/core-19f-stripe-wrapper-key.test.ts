// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-19f (spec 01 กฎข้อ 75 c, AC-113 — review #310): `<Elements>` ของ react-stripe-js ไม่รับ `options.clientSecret`
// ที่เปลี่ยนหลัง mount ("Unsupported prop change: options.clientSecret is not a mutable property") — สลับ
// บัตร → พร้อมเพย์ → บัตร แล้ว Payment Element ยังผูกกับ PaymentIntent ตัวแรก (CI run 42526168546: ช่องเลขบัตรไม่ขึ้น)
// mock จำลองพฤติกรรมนั้น: อ่าน clientSecret ครั้งเดียวตอน mount
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ options, children }: { options: { clientSecret?: string }; children: ReactNode }) => {
    const [boundSecret] = useState(options.clientSecret)
    return createElement("div", { "data-testid": "elements", "data-secret": boundSecret }, children)
  },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = (provider_id: string, client_secret: string) =>
  ({ id: `ps_${client_secret}`, provider_id, status: "pending", data: { client_secret } }) as never

let container: HTMLDivElement
let root: Root

const render = async (paymentSession: unknown) => {
  const { default: StripeWrapper } = await import("@modules/checkout/components/payment-wrapper/stripe-wrapper")
  await act(async () => {
    root.render(
      createElement(
        StripeWrapper,
        { paymentSession, stripeKey: "pk_test_x", stripePromise: Promise.resolve(null) } as never,
        createElement("span")
      )
    )
  })
}

const boundSecret = () => container.querySelector('[data-testid="elements"]')!.getAttribute("data-secret")

describe("CORE-19f: StripeWrapper ผูก Elements กับ client secret ของ session ล่าสุด (กฎข้อ 75 c)", () => {
  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("บัตร → พร้อมเพย์ → บัตร (PaymentIntent ใหม่ทุกครั้ง) → Elements ใช้ client secret ล่าสุดเสมอ", async () => {
    await render(session("pp_stripe_stripe", "pi_card1_secret"))
    expect(boundSecret()).toBe("pi_card1_secret")

    await render(session("pp_stripe-promptpay_stripe", "pi_pp_secret"))
    expect(boundSecret()).toBe("pi_pp_secret")

    await render(session("pp_stripe_stripe", "pi_card2_secret"))
    expect(boundSecret()).toBe("pi_card2_secret")
  })

  it("พร้อมเพย์ได้ PaymentIntent ใหม่ (QR หมดอายุ/คืนเงินแล้วสร้างใหม่) → ไม่ mount children ใหม่ (state หมดอายุ/คืนเงินของ PAY-6b ไม่หาย)", async () => {
    await render(session("pp_stripe-promptpay_stripe", "pi_pp1_secret"))
    const elements = container.querySelector('[data-testid="elements"]')
    await render(session("pp_stripe-promptpay_stripe", "pi_pp2_secret"))
    // พร้อมเพย์ไม่ใช้ Payment Element — อ่าน client secret จาก cart เอง (promptpay-payment) จึงไม่ต้องผูก Elements ใหม่
    expect(container.querySelector('[data-testid="elements"]')).toBe(elements)
  })
})
