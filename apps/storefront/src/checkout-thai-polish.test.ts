import fs from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4e (spec 01 กฎข้อ 54–55, AC-90): error ของ server action ใน checkout เป็นไทยผ่าน friendlyErrorMessage,
// Stripe Elements ใช้ locale "th", placeholder ของ CountrySelect เป็นไทย และ STORE_NAME ตามด้วยคำไทยมีเว้นวรรค
const THAI = /[฀-๿]/
const RAW = "Cart not found"

const update = vi.fn()
const elementsProps = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: { store: { cart: { update: (...a: unknown[]) => update(...a) } } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("carts-t"),
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: (props: { children: unknown }) => {
    elementsProps(props)
    return props.children
  },
}))

const expectThaiNotRaw = (message: unknown) => {
  expect(typeof message).toBe("string")
  expect(message).toMatch(THAI)
  expect(message).not.toContain(RAW)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("server action ของ checkout ไม่ส่งข้อความอังกฤษของ Medusa ตรง (AC-90)", () => {
  it("setAddresses: SDK throw → ข้อความไทย", async () => {
    update.mockRejectedValue(new Error(RAW))
    const { setAddresses } = await import("@lib/data/cart")
    const form = new FormData()
    form.set("shipping_address.country_code", "th")
    form.set("same_as_billing", "on")
    expectThaiNotRaw(await setAddresses(null, form))
  })

  it("submitPromotionForm: SDK throw → ข้อความไทย", async () => {
    update.mockRejectedValue(new Error(RAW))
    const { submitPromotionForm } = await import("@lib/data/cart")
    const form = new FormData()
    form.set("code", "NOPE")
    expectThaiNotRaw(await submitPromotionForm(null, form))
  })

  const cart = { id: "cart_1", payment_collection: { id: "pay_col_1" } } as never

  it("renewPromptPaySession: fetch throw → ข้อความไทย", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(RAW)))
    const { renewPromptPaySession } = await import("@lib/data/cart")
    const result = await renewPromptPaySession(cart, "pp_stripe-promptpay_stripe")
    expect(result.status).toBe("error")
    expectThaiNotRaw("message" in result ? result.message : undefined)
  })

  it("renewPromptPaySession: backend 404 พร้อม message อังกฤษ → ข้อความไทย", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ type: "not_found", message: RAW }), { status: 404 })
      )
    )
    const { renewPromptPaySession } = await import("@lib/data/cart")
    const result = await renewPromptPaySession(cart, "pp_stripe-promptpay_stripe")
    expect(result.status).toBe("error")
    expectThaiNotRaw("message" in result ? result.message : undefined)
  })
})

describe("UI ของ checkout (กฎข้อ 54–55)", () => {
  it("StripeWrapper ส่ง locale th ให้ <Elements>", async () => {
    const { default: StripeWrapper } = await import(
      "@modules/checkout/components/payment-wrapper/stripe-wrapper"
    )
    const props: Parameters<typeof StripeWrapper>[0] = {
      paymentSession: { data: { client_secret: "pi_1_secret_x" } } as never,
      stripeKey: "pk_test_x",
      stripePromise: Promise.resolve(null),
      children: null,
    }
    renderToStaticMarkup(createElement(StripeWrapper, props))
    expect(elementsProps).toHaveBeenCalledTimes(1)
    expect(elementsProps.mock.calls[0][0].options).toMatchObject({ locale: "th" })
  })

  it("ชื่อวิธีชำระพร้อมเพย์เป็น \"พร้อมเพย์\"", async () => {
    const { paymentInfoMap } = await import("@lib/constants")
    expect(paymentInfoMap["pp_stripe-promptpay_stripe"].title).toBe("พร้อมเพย์")
  })

  it("CountrySelect ใช้ placeholder \"เลือกประเทศ\"", async () => {
    const { default: CountrySelect } = await import(
      "@modules/checkout/components/country-select"
    )
    const html = renderToStaticMarkup(createElement(CountrySelect, { name: "country" }))
    expect(html).toContain("เลือกประเทศ")
  })

  it("{STORE_NAME} ที่ตามด้วยอักษรไทยใน JSX มีเว้นวรรค", () => {
    const files = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) return files(p)
        return /\.tsx$/.test(e.name) ? [p] : []
      })
    const glued = files(__dirname).filter((f) =>
      /\{STORE_NAME\}[฀-๿]/.test(fs.readFileSync(f, "utf8"))
    )
    expect(glued.map((f) => path.relative(__dirname, f))).toEqual([])
  })
})
