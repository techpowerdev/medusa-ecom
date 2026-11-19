import { readFileSync } from "node:fs"
import path from "node:path"
import { FetchError } from "@medusajs/js-sdk"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-52 (spec 01 กฎข้อ 110, AC-147): (a) ตะกร้าว่าง → /cart ทั้งตอนเปิด checkout และตอนยืนยัน,
// (b) setAddresses trim ช่องบังคับ — ว่างหลัง trim ไม่เรียก updateCart, (c) ไม่มี shipping_methods → ไม่มี ShippingDetails,
// (e) shipping-address ไม่มี eslint-disable
const THAI = /[฀-๿]/

const retrieve = vi.fn()
const update = vi.fn()
const complete = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`)
})
const retrieveCartData = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    store: {
      cart: {
        retrieve: (...a: unknown[]) => retrieve(...a),
        update: (...a: unknown[]) => update(...a),
        complete: (...a: unknown[]) => complete(...a),
      },
    },
  },
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
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))

const voucher = { requires_shipping: false }
const shirt = { requires_shipping: true }
const serverCart = (...items: { requires_shipping: boolean }[]) =>
  retrieve.mockResolvedValue({ cart: { id: "cart_1", items } })

const REQUIRED = ["first_name", "last_name", "address_1", "postal_code", "city"] as const

const fillAddress = (form: FormData, prefix: "shipping_address" | "billing_address") => {
  form.set(`${prefix}.first_name`, "สมชาย")
  form.set(`${prefix}.last_name`, "ใจดี")
  form.set(`${prefix}.address_1`, "99 ถนนสุขุมวิท")
  form.set(`${prefix}.postal_code`, "10110")
  form.set(`${prefix}.city`, "วัฒนา")
  form.set(`${prefix}.country_code`, "th")
  return form
}
const baseForm = () => {
  const form = new FormData()
  form.set("checkout_country_code", "th")
  form.set("email", "a@example.com")
  return form
}
const shippingForm = () => {
  const form = fillAddress(baseForm(), "shipping_address")
  form.set("same_as_billing", "on")
  return form
}
const billingForm = () => fillAddress(baseForm(), "billing_address")

const submit = async (form: FormData) => (await import("@lib/data/cart")).setAddresses(null, form)
// redirect ของ mock throw — สำเร็จ = REDIRECT, ล้ม = ข้อความที่คืน
const submitResult = (form: FormData) => submit(form).catch((e: Error) => e.message)

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue({ cart: { id: "cart_1" } })
})

describe("setAddresses: ช่องบังคับที่เป็นช่องว่างล้วน (กฎข้อ 110b)", () => {
  it.each(REQUIRED)("ที่อยู่จัดส่ง %s = \"   \" → ข้อความไทย ไม่เรียก updateCart ไม่ redirect", async (field) => {
    serverCart(shirt)
    const form = shippingForm()
    form.set(`shipping_address.${field}`, "   ")

    const message = await submitResult(form)

    expect(message).toMatch(THAI)
    expect(message).not.toMatch(/REDIRECT/)
    expect(update).not.toHaveBeenCalled()
  })

  it.each(REQUIRED)("ที่อยู่ใบเสร็จ (ไม่ใช้ที่อยู่เดียวกัน) %s = \"\\t \" → ไม่เรียก updateCart", async (field) => {
    serverCart(shirt)
    const form = fillAddress(shippingForm(), "billing_address")
    form.delete("same_as_billing")
    form.set(`billing_address.${field}`, "\t ")

    expect(await submitResult(form)).toMatch(THAI)
    expect(update).not.toHaveBeenCalled()
  })

  it.each(REQUIRED)("digital-only %s = \" \" → ไม่เรียก updateCart", async (field) => {
    serverCart(voucher)
    const form = billingForm()
    form.set(`billing_address.${field}`, " ")

    expect(await submitResult(form)).toMatch(THAI)
    expect(update).not.toHaveBeenCalled()
  })

  it("ช่องบังคับมีช่องว่างหน้า/หลัง → ส่งค่าที่ trim แล้ว", async () => {
    serverCart(shirt)
    const form = shippingForm()
    form.set("shipping_address.city", "  วัฒนา  ")
    form.set("shipping_address.first_name", " สมชาย")

    expect(await submitResult(form)).toBe("REDIRECT /th/checkout?step=delivery")
    const body = update.mock.calls[0][1]
    expect(body.shipping_address.city).toBe("วัฒนา")
    expect(body.shipping_address.first_name).toBe("สมชาย")
    expect(body.billing_address).toEqual(body.shipping_address)
  })

  it("digital-only ที่อยู่ครบ → ยังบันทึกและไปขั้น payment", async () => {
    serverCart(voucher)

    expect(await submitResult(billingForm())).toBe("REDIRECT /th/checkout?step=payment")
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe("placeOrder บน cart ที่ไม่มี item (กฎข้อ 110a)", () => {
  // Medusa 2.22.1 `validateCartItemsStep` (core-flows/dist/cart/steps/validate-cart-items.js)
  const empty = () => new FetchError("Cannot complete a cart with no items", "Bad Request", 400)
  const place = async (countryCode?: string) =>
    (await import("@lib/data/cart")).placeOrder("cart_1", undefined, countryCode)

  it("→ redirect /<countryCode>/cart", async () => {
    complete.mockRejectedValueOnce(empty())
    await expect(place("th")).rejects.toThrow("REDIRECT /th/cart")
  })

  it("country ใน URL ไม่ผ่าน safeCountryCode → /cart ภายในร้าน", async () => {
    complete.mockRejectedValueOnce(empty())
    await expect(place("//example.org")).rejects.toThrow("REDIRECT /cart")
  })

  it("400 อื่น → ยังคืน { error: \"failed\" }", async () => {
    complete.mockRejectedValueOnce(new FetchError("Payment sessions are required", "Bad Request", 400))
    await expect(place("th")).resolves.toEqual({ error: "failed" })
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe("หน้า /checkout ของ cart ที่ไม่มี item (กฎข้อ 110a)", () => {
  const open = async (cart: unknown) => {
    vi.resetModules()
    vi.doMock("@lib/data/cart", () => ({ retrieveCart: (...a: unknown[]) => retrieveCartData(...a) }))
    vi.doMock("@lib/data/customer", () => ({ retrieveCustomer: vi.fn().mockResolvedValue(null) }))
    vi.doMock("@modules/checkout/components/payment-wrapper", () => ({ default: () => null }))
    vi.doMock("@modules/checkout/templates/checkout-form", () => ({ default: () => null }))
    vi.doMock("@modules/checkout/templates/checkout-summary", () => ({ default: () => null }))
    retrieveCartData.mockResolvedValue(cart)
    const { default: Checkout } = await import("./app/[countryCode]/(checkout)/checkout/page")
    return Checkout({
      params: Promise.resolve({ countryCode: "th" }),
      searchParams: Promise.resolve({ step: "review" }),
    })
  }

  it.each([
    ["items = []", { id: "cart_1", items: [] }],
    ["ไม่มี items", { id: "cart_1" }],
  ])("%s → redirect /th/cart", async (_, cart) => {
    await expect(open(cart)).rejects.toThrow("REDIRECT /th/cart")
  })

  it("มี item → render หน้า checkout", async () => {
    await expect(open({ id: "cart_1", items: [{ id: "item_1" }] })).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  // ตะกร้าที่ล้างจากอุปกรณ์/แท็บอื่น (หรือ Store API ตรง) ไม่ revalidate tag `carts-<cache id>` ของ browser นี้ —
  // อ่านแบบ force-cache จะได้ cart เดิมที่ยังมี item
  it("อ่าน cart แบบ fresh (ไม่ใช้ data cache)", async () => {
    await open({ id: "cart_1", items: [{ id: "item_1" }] })
    expect(retrieveCartData).toHaveBeenCalledWith(undefined, undefined, { fresh: true })
  })
})

describe("หน้า /cart อ่าน cart แบบ fresh (กฎข้อ 110a)", () => {
  it("หลัง redirect จาก checkout แสดงตะกร้าว่างจริง ไม่ใช่ cart เดิมจาก data cache", async () => {
    vi.resetModules()
    vi.doMock("@lib/data/cart", () => ({ retrieveCart: (...a: unknown[]) => retrieveCartData(...a) }))
    vi.doMock("@lib/data/customer", () => ({ retrieveCustomer: vi.fn().mockResolvedValue(null) }))
    vi.doMock("@lib/data/flash-sales", () => ({ getCartFlashExceeded: vi.fn().mockResolvedValue({}) }))
    vi.doMock("@modules/cart/templates", () => ({ default: () => null }))
    retrieveCartData.mockResolvedValue({ id: "cart_1", items: [] })
    const { default: Cart } = await import("./app/[countryCode]/(main)/cart/page")

    await Cart()

    expect(retrieveCartData).toHaveBeenCalledWith(undefined, undefined, { fresh: true })
  })
})

describe("ShippingDetails ของ order ที่ไม่มี shipping_methods (กฎข้อ 110c)", () => {
  const render = async (order: unknown) => {
    const { default: ShippingDetails } = await import("@modules/order/components/shipping-details")
    return renderToStaticMarkup(createElement(ShippingDetails, { order } as never))
  }
  const order = { id: "order_1", currency_code: "thb", email: "a@example.com", shipping_address: { address_1: "1" } }

  it.each([
    ["shipping_methods = []", { ...order, shipping_methods: [] }],
    ["ไม่มี shipping_methods", order],
  ])("voucher ล้วน (%s) → ไม่ render", async (_, o) => {
    const html = await render(o)
    expect(html).toBe("")
    expect(html).not.toContain("shipping-details-heading")
  })

  it("มี shipping method → ยังมี shipping-details-heading", async () => {
    const html = await render({ ...order, shipping_methods: [{ name: "Standard", total: 50 }] })
    expect(html).toContain('data-testid="shipping-details-heading"')
  })
})

describe("shipping-address ไม่มี eslint-disable (กฎข้อ 110e)", () => {
  it("ไม่มี eslint-disable", () => {
    const source = readFileSync(
      path.join(__dirname, "modules/checkout/components/shipping-address/index.tsx"),
      "utf8"
    )
    expect(source).not.toMatch(/eslint-disable/)
  })
})
