// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// PAY-14 (spec 06 กฎข้อ 16, AC-27): session ที่เลือกอยู่ชี้ PI ที่จบแล้ว → ไม่ mount Elements (StripeCardFields ตรวจ PI แล้วเรียก
// onStaleSession) → ขั้น payment สร้าง session ใหม่อัตโนมัติ 1 ครั้ง; ล้ม → notice ไทย + คลิกตัวเลือกที่เลือกอยู่สร้างใหม่ได้;
// PAYMENT_ALREADY_COMPLETED → complete cart (รอ order ของ ADR-015) ไม่สร้าง session ใหม่
const CARD = "pp_stripe_stripe"
const THAI = /[\u0E00-\u0E7F]/

const router = { refresh: vi.fn(), push: vi.fn() }
const initiatePaymentSession = vi.fn()
const placeOrder = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/th/checkout",
  useSearchParams: () => new URLSearchParams("step=payment"),
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: (...a: unknown[]) => initiatePaymentSession(...a),
  placeOrder: (...a: unknown[]) => placeOrder(...a),
}))
// ตัวเลือกบัตร: ปุ่ม "stale" = StripeCardFields พบว่า PI จบแล้ว; ปุ่ม radio อยู่ภายใน wrapper ของตัวเลือก (คลิก bubble ขึ้นไป)
vi.mock("@modules/checkout/components/payment-container", async () => {
  const { createElement: h } = await import("react")
  return {
    default: () => null,
    StripePaymentContainer: ({ onStaleSession, clientSecret }: { onStaleSession: () => void; clientSecret?: string }) =>
      h("div", null, [
        h("button", { key: "s", "data-testid": "stale", "data-secret": clientSecret, onClick: onStaleSession }),
        h("button", { key: "r", "data-testid": "card-radio" }),
      ]),
  }
})
vi.mock("@headlessui/react", async () => {
  const { createElement: h } = await import("react")
  return { RadioGroup: ({ children }: { children: unknown }) => h("div", null, children as never) }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cart = {
  id: "cart_1",
  total: 100,
  shipping_methods: [{ id: "sm_1" }],
  payment_collection: {
    id: "pay_col_1",
    payment_sessions: [{ provider_id: CARD, status: "pending", data: { client_secret: "pi_old_secret_x" } }],
  },
} as never

let container: HTMLDivElement
let root: Root

const render = async () => {
  const { default: Payment } = await import("@modules/checkout/components/payment")
  await act(async () => {
    root.render(createElement(Payment, { cart, availablePaymentMethods: [{ id: CARD }], deliveryDone: true }))
  })
}
const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => {
    byTestId(id)!.click()
  })
}

describe("PAY-14: ขั้น payment ไม่ติดกับ session ที่ชี้ PI ที่จบแล้ว", () => {
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

  it("ส่ง client secret ของ session ที่เลือกให้ตัวตรวจ PI", async () => {
    await render()
    expect(byTestId("stale")!.dataset.secret).toBe("pi_old_secret_x")
  })

  it("PI จบแล้ว → สร้าง session ใหม่อัตโนมัติ 1 ครั้งแล้ว refresh cart", async () => {
    initiatePaymentSession.mockResolvedValue({ ok: true })
    await render()
    await click("stale")

    expect(initiatePaymentSession).toHaveBeenCalledTimes(1)
    expect(initiatePaymentSession).toHaveBeenCalledWith(cart, { provider_id: CARD })
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(byTestId("payment-session-reset-notice")).toBeNull()
  })

  it("สร้างอัตโนมัติล้ม → notice ไทย; คลิกตัวเลือกที่เลือกอยู่ → สร้าง session ใหม่สำเร็จ", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "failed" }).mockResolvedValueOnce({ ok: true })
    await render()
    await click("stale")

    const notice = byTestId("payment-session-reset-notice")
    expect(notice).not.toBeNull()
    expect(notice!.textContent).toMatch(THAI)
    expect(notice!.textContent).not.toMatch(/terminal|payment_intent/i)

    await click("card-radio")
    expect(initiatePaymentSession).toHaveBeenCalledTimes(2)
    expect(byTestId("payment-session-reset-notice")).toBeNull()
  })

  it("พบ PI จบแล้วซ้ำหลังสร้างอัตโนมัติไปแล้ว → ไม่สร้างเองอีก แสดง notice ให้ลูกค้าเลือกใหม่", async () => {
    initiatePaymentSession.mockResolvedValue({ ok: true })
    await render()
    await click("stale")
    await click("stale")

    expect(initiatePaymentSession).toHaveBeenCalledTimes(1)
    expect(byTestId("payment-session-reset-notice")).not.toBeNull()
  })

  it("ปุ่ม payment-session-retry สร้าง session ใหม่ได้", async () => {
    initiatePaymentSession.mockResolvedValueOnce({ error: "failed" }).mockResolvedValueOnce({ ok: true })
    await render()
    await click("stale")
    await click("payment-session-retry")

    expect(initiatePaymentSession).toHaveBeenCalledTimes(2)
  })

  it("PAYMENT_ALREADY_COMPLETED (จ่ายแล้วยังไม่คืน) → complete cart แบบรอ order ไม่สร้าง session ใหม่", async () => {
    initiatePaymentSession.mockResolvedValue({ error: "PAYMENT_ALREADY_COMPLETED" })
    placeOrder.mockResolvedValue(undefined) // สำเร็จ = redirect ของ Next
    await render()
    await click("stale")

    expect(initiatePaymentSession).toHaveBeenCalledTimes(1)
    expect(placeOrder).toHaveBeenCalledWith("cart_1", undefined, "th")
    expect(byTestId("payment-session-reset-notice")).toBeNull()
  })
})
