// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  LOGIN_NOTICE_PARAM,
  PAYMENT_RECEIVED,
  PAYMENT_RECEIVED_NOTICE,
  loginNoticeRedirect,
  readLoginNotice,
  unauthorizedLoginPath,
} from "@lib/util/login-notice"

// CORE-95 (spec 01 กฎข้อ 151, AC-192 — owner Q-C16 = ก): ทางบัตรที่ตัดเงินแล้ว (PI succeeded/requires_capture) แต่ placeOrder ได้
// `unauthorized` → หน้า login พร้อม `notice=payment_received` (allow-list ค่าเดียว) แล้ว login สำเร็จไป `/<cc>/account/orders`
// manual (ยังไม่จ่าย) คงเดิม `/<cc>/account` (regression CORE-76) — ใช้ component จริง (PaymentButton, LoginTemplate, Login)
const placeOrder = vi.fn()
const confirmPayment = vi.fn()
const push = vi.fn()
const search = vi.hoisted(() => ({ current: new URLSearchParams() }))
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`)
})

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "th" }),
  useRouter: () => ({ push }),
  useSearchParams: () => search.current,
  redirect: (url: string) => redirect(url),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("REDIRECT ")) throw error
  },
}))
vi.mock("@lib/data/cart", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a), addToCart: vi.fn() }))
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
vi.mock("@lib/config", () => ({
  sdk: {
    auth: { login: vi.fn().mockResolvedValue("tok") },
    store: { customer: { retrieve: vi.fn().mockResolvedValue({ customer: {} }) } },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("t"),
  getCartId: vi.fn().mockResolvedValue(undefined),
  setAuthToken: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn(async () => ({ id: "reg_th" })) }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const THAI = /[฀-๿]/
const CARD = "pp_stripe_stripe"
const MANUAL = "pp_system_default"
const NOTICE_PATH = "/th/account?notice=payment_received"

describe("helper (CORE-95)", () => {
  it("unauthorizedLoginPath: ตัดเงินแล้ว → notice=payment_received; ยังไม่ตัดเงิน → /<cc>/account เปล่า", () => {
    expect(unauthorizedLoginPath("th", true)).toBe(NOTICE_PATH)
    expect(unauthorizedLoginPath("th", false)).toBe("/th/account")
  })

  it("ข้อความ notice เป็นไทยตาม owner", () => {
    expect(PAYMENT_RECEIVED_NOTICE).toBe("ได้รับชำระเงินแล้ว กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ")
  })

  it.each([
    ["payment_received", PAYMENT_RECEIVED],
    ["<script>alert(1)</script>", null],
    ["x", null],
    ["PAYMENT_RECEIVED", null],
    ["payment_received ", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("readLoginNotice(%j) → %j (allow-list ค่าเดียว)", (value, expected) => {
    expect(readLoginNotice(value)).toBe(expected)
  })

  const form = (entries: Record<string, string>) => {
    const f = new FormData()
    Object.entries(entries).forEach(([k, v]) => f.set(k, v))
    return f
  }

  it.each([
    [{ notice: "payment_received", country_code: "th" }, "/th/account/orders"],
    [{ notice: "payment_received", country_code: "/evil.example" }, "/account/orders"],
    [{ notice: "payment_received" }, "/account/orders"],
    [{ notice: "x", country_code: "th" }, null],
    [{ country_code: "th" }, null],
  ])("loginNoticeRedirect(%j) → %j (ค่าคงที่ ไม่รับ path จากฟอร์ม)", (entries, expected) => {
    expect(loginNoticeRedirect(form(entries))).toBe(expected)
  })
})

describe("ปุ่มยืนยันคำสั่งซื้อ: ปลายทางตาม (ทางชำระ, kind) (CORE-95)", () => {
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

  const submit = async (provider: string) => {
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

  const KINDS = [{ kind: "unauthorized" }, { kind: "failed" }, { kind: "processing" }, { kind: "refunded", code: "FLASH_SOLD_OUT" }]
  const TABLE: [string, { kind: string }, string | null][] = [
    ...KINDS.map((o): [string, { kind: string }, string | null] => [CARD, o, o.kind === "unauthorized" ? NOTICE_PATH : null]),
    ...KINDS.map((o): [string, { kind: string }, string | null] => [MANUAL, o, o.kind === "unauthorized" ? "/th/account" : null]),
  ]

  it.each(TABLE)("%s + %j → %j", async (provider, outcome, expected) => {
    placeOrder.mockResolvedValueOnce(outcome)
    placeOrder.mockReturnValue(new Promise(() => {})) // processing: รอบอ่านซ้ำไม่ resolve
    await submit(provider)
    if (expected) {
      expect(push).toHaveBeenCalledTimes(1)
      expect(push).toHaveBeenCalledWith(expected)
    } else {
      expect(push).not.toHaveBeenCalled()
    }
  })

  it("บัตร PI requires_capture (error.payment_intent) + unauthorized → notice=payment_received", async () => {
    confirmPayment.mockResolvedValue({ error: { type: "card_error", payment_intent: { status: "requires_capture" } } })
    placeOrder.mockResolvedValueOnce({ kind: "unauthorized" })
    await submit(CARD)
    expect(push).toHaveBeenCalledWith(NOTICE_PATH)
  })
})

describe("หน้า login อ่าน notice แบบ allow-list (CORE-95)", () => {
  let container: HTMLDivElement
  let root: Root
  const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    search.current = new URLSearchParams()
  })

  const renderLogin = async (query: string) => {
    search.current = new URLSearchParams(query)
    const { default: LoginTemplate } = await import("@modules/account/templates/login-template")
    await act(async () => {
      root.render(createElement(LoginTemplate))
    })
  }

  const hiddenNotice = () => container.querySelector<HTMLInputElement>(`form input[type="hidden"][name="${LOGIN_NOTICE_PARAM}"]`)

  it("notice=payment_received → login-payment-received-notice ไทย + ฟอร์ม login ส่ง notice ต่อ", async () => {
    await renderLogin("notice=payment_received")
    const notice = byTestId("login-payment-received-notice")
    expect(notice?.textContent).toBe(PAYMENT_RECEIVED_NOTICE)
    expect(notice?.textContent).toMatch(THAI)
    expect(hiddenNotice()?.value).toBe(PAYMENT_RECEIVED)
    expect(container.querySelector<HTMLInputElement>('form input[type="hidden"][name="country_code"]')?.value).toBe("th")
  })

  it.each(["notice=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "notice=x", ""])("%j → ไม่มี notice ไม่ render ค่าจาก URL", async (query) => {
    await renderLogin(query)
    expect(byTestId("login-payment-received-notice")).toBeNull()
    expect(hiddenNotice()).toBeNull()
    expect(container.innerHTML).not.toContain("<script")
    expect(container.innerHTML).not.toContain("alert(1)")
    expect(container.innerHTML).not.toContain('value="x"')
  })
})

describe("server action login + notice (CORE-95)", () => {
  const loginWith = async (entries: Record<string, string>) => {
    const { login } = await import("@lib/data/customer")
    const form = new FormData()
    form.set("email", "a@example.com")
    form.set("password", "pw")
    Object.entries(entries).forEach(([k, v]) => form.set(k, v))
    return login(null, form)
  }

  beforeEach(() => {
    redirect.mockClear()
  })

  it("login สำเร็จพร้อม notice=payment_received → /th/account/orders", async () => {
    await expect(loginWith({ notice: "payment_received", country_code: "th" })).rejects.toThrow(/^REDIRECT \/th\/account\/orders$/)
  })

  it("notice ที่ไม่อยู่ใน allow-list → ไม่ redirect (พฤติกรรมเดิม)", async () => {
    await expect(loginWith({ notice: "/evil.example", country_code: "th" })).resolves.toBeDefined()
    expect(redirect).not.toHaveBeenCalled()
  })
})
