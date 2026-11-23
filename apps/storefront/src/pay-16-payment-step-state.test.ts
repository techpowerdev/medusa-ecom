// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// PAY-16 (spec 06 กฎข้อ 18, AC-29): สถานะขั้น payment หลัง session ชี้ PI ที่จบแล้ว (ต่อจาก PAY-14)
// (a) notice หายเมื่อเปลี่ยนวิธีหรือ client secret เปลี่ยน; (b) ไม่สร้าง session ซ้อนระหว่าง renew;
// (c) refresh ไม่มา → 10 วินาที notice และไม่ค้าง skeleton (ซ่อนช่องบัตร); (d) ระหว่างรอ order ของ PAYMENT_ALREADY_COMPLETED radio disabled
const CARD = "pp_stripe_stripe"
const MANUAL = "pp_system_default"

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
// ตัวเลือกบัตร: ปุ่ม "stale" = StripeCardFields พบว่า PI จบแล้ว; `data-fields-hidden` = ไม่ render ช่องบัตร/skeleton
vi.mock("@modules/checkout/components/payment-container", async () => {
  const { createElement: h } = await import("react")
  return {
    default: () => null,
    StripePaymentContainer: ({ onStaleSession, fieldsHidden }: { onStaleSession: () => void; fieldsHidden?: boolean }) =>
      h("div", { "data-testid": "card-option", "data-fields-hidden": String(!!fieldsHidden) }, [
        h("button", { key: "s", "data-testid": "stale", onClick: onStaleSession }),
        h("button", { key: "r", "data-testid": "card-radio" }),
      ]),
  }
})
// RadioGroup: `data-disabled` = prop disabled ของ group (headless ส่งต่อให้ทุกตัวเลือกเป็น aria-disabled); ปุ่ม pick-manual = onChange
vi.mock("@headlessui/react", async () => {
  const { createElement: h } = await import("react")
  return {
    RadioGroup: ({ children, disabled, onChange }: { children: unknown; disabled?: boolean; onChange: (v: string) => void }) =>
      h("div", { "data-testid": "radio-group", "data-disabled": String(!!disabled) }, [
        h("div", { key: "c" }, children as never),
        h("button", { key: "m", "data-testid": "pick-manual", onClick: () => onChange(MANUAL) }),
      ]),
  }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cartWithSecret = (secret: string) =>
  ({
    id: "cart_1",
    total: 100,
    shipping_methods: [{ id: "sm_1" }],
    payment_collection: {
      id: "pay_col_1",
      payment_sessions: [{ provider_id: CARD, status: "pending", data: { client_secret: secret } }],
    },
  }) as never
const cart = cartWithSecret("pi_old_secret_x")
// session เดิมถูก cancel (ไม่มี session pending) — ไม่ใช่ session ใหม่
const cartWithoutPendingSession = {
  ...(cart as object),
  payment_collection: {
    id: "pay_col_1",
    payment_sessions: [{ provider_id: CARD, status: "canceled", data: { client_secret: "pi_old_secret_x" } }],
  },
} as never

let container: HTMLDivElement
let root: Root

const render = async (props: unknown = cart) => {
  const { default: Payment } = await import("@modules/checkout/components/payment")
  await act(async () => {
    root.render(
      createElement(Payment, {
        cart: props as never,
        availablePaymentMethods: [{ id: CARD }, { id: MANUAL }],
        deliveryDone: true,
      })
    )
  })
}
const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => {
    byTestId(id)!.click()
  })
}
const cardSessionCalls = () => initiatePaymentSession.mock.calls.filter(([, body]) => body?.provider_id === CARD).length

/** session ชี้ PI ที่จบแล้ว + สร้างใหม่อัตโนมัติล้ม → notice */
const withResetNotice = async () => {
  initiatePaymentSession.mockResolvedValueOnce({ error: "failed" })
  await render()
  await click("stale")
  expect(byTestId("payment-session-reset-notice")).not.toBeNull()
}

describe("PAY-16 (AC-29): สถานะขั้น payment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it("(a) notice แล้วเลือก manual → notice และปุ่มลองอีกครั้งหาย ไม่สร้าง session ของบัตรเพิ่ม", async () => {
    await withResetNotice()
    await click("pick-manual")

    expect(byTestId("payment-session-reset-notice")).toBeNull()
    expect(byTestId("payment-session-retry")).toBeNull()
    expect(cardSessionCalls()).toBe(1)
  })

  it("(a) notice แล้ว cart ใน props ได้ client secret ใหม่ → notice หาย", async () => {
    await withResetNotice()
    await render(cartWithSecret("pi_new_secret_y"))

    expect(byTestId("payment-session-reset-notice")).toBeNull()
  })

  it("(a) review #541: notice แล้ว cart ใน props ไม่มี session pending (session เดิมถูก cancel) → notice ยังอยู่และไม่ค้าง skeleton", async () => {
    await withResetNotice()
    await render(cartWithoutPendingSession)

    expect(byTestId("payment-session-reset-notice")).not.toBeNull()
    expect(byTestId("payment-session-retry")).not.toBeNull()
    expect(byTestId("card-option")!.dataset.fieldsHidden).toBe("true")
  })

  it("(b) ตรวจพบ PI จบแล้วซ้ำระหว่าง renew กำลังรอ → ไม่ขึ้น notice ซ้อน ไม่สร้าง session เพิ่ม", async () => {
    await withResetNotice()
    initiatePaymentSession.mockReturnValueOnce(new Promise(() => {}))
    await click("payment-session-retry")
    await click("stale")

    expect(byTestId("payment-session-reset-notice")).toBeNull()
    expect(cardSessionCalls()).toBe(2)
  })

  it("(c) renew สำเร็จแต่ refresh ไม่มา → ก่อน 10 วินาทีรอ (ช่องบัตรยังแสดง), 10 วินาที → notice และซ่อนช่องบัตร (ไม่ค้าง skeleton)", async () => {
    vi.useFakeTimers()
    initiatePaymentSession.mockResolvedValue({ ok: true })
    await render()
    await click("stale")
    await act(async () => {
      vi.advanceTimersByTime(9_000)
    })
    expect(byTestId("card-option")!.dataset.fieldsHidden).toBe("false")

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(byTestId("payment-session-reset-notice")).not.toBeNull()
    expect(byTestId("card-option")!.dataset.fieldsHidden).toBe("true")

    // ลองอีกครั้ง → ซ่อน notice และแสดงช่องบัตร (skeleton ระหว่างรอ) อีกครั้ง
    initiatePaymentSession.mockReturnValueOnce(new Promise(() => {}))
    await click("payment-session-retry")
    expect(byTestId("card-option")!.dataset.fieldsHidden).toBe("false")
  })

  it("(c) review #541: renew สำเร็จแต่ cart ที่ refresh มาไม่มี session pending → 10 วินาที notice และซ่อนช่องบัตร", async () => {
    vi.useFakeTimers()
    initiatePaymentSession.mockResolvedValue({ ok: true })
    await render()
    await click("stale")
    await render(cartWithoutPendingSession)
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(byTestId("payment-session-reset-notice")).not.toBeNull()
    expect(byTestId("card-option")!.dataset.fieldsHidden).toBe("true")
  })

  it("(d) PAYMENT_ALREADY_COMPLETED → ระหว่างรอ order radio disabled; complete ไม่สำเร็จ → เลือกได้อีก", async () => {
    initiatePaymentSession.mockResolvedValue({ error: "PAYMENT_ALREADY_COMPLETED" })
    let settle!: (v: unknown) => void
    placeOrder.mockReturnValueOnce(new Promise((r) => (settle = r)))
    await render()
    expect(byTestId("radio-group")!.dataset.disabled).toBe("false")
    await click("stale")

    expect(placeOrder).toHaveBeenCalledTimes(1)
    expect(byTestId("radio-group")!.dataset.disabled).toBe("true")

    await act(async () => {
      settle({ kind: "failed" })
    })
    expect(byTestId("radio-group")!.dataset.disabled).toBe("false")
  })

  it("(d) placeOrder ตอบ processing (รอ order ต่อ) → radio ยัง disabled", async () => {
    initiatePaymentSession.mockResolvedValue({ error: "PAYMENT_ALREADY_COMPLETED" })
    placeOrder.mockResolvedValue({ kind: "processing" })
    await render()
    await click("stale")

    expect(byTestId("checkout-processing-notice")).not.toBeNull()
    expect(byTestId("radio-group")!.dataset.disabled).toBe("true")
  })
})
