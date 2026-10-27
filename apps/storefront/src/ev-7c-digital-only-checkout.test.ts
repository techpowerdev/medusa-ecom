import { HttpTypes } from "@medusajs/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkoutStep,
  deliveryStepDone,
  isDigitalOnlyCart,
} from "@lib/util/digital-checkout"

// EV-7c (spec 02 กฎข้อ 24, AC-3 ส่วน storefront, AC-37): checkout ของ cart ที่ทุก line requires_shipping=false
const update = vi.fn()
const complete = vi.fn()
const redirect = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    store: {
      cart: {
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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }))

type Line = { requires_shipping?: boolean | null }
const cartOf = (
  items: Line[],
  extra: Partial<HttpTypes.StoreCart> = {}
): HttpTypes.StoreCart =>
  ({ items, shipping_methods: [], ...extra }) as unknown as HttpTypes.StoreCart

const voucher = { requires_shipping: false }
const shirt = { requires_shipping: true }
const address = { address_1: "99 ถนนสุขุมวิท" } as HttpTypes.StoreCartAddress

beforeEach(() => {
  vi.clearAllMocks()
})

describe("isDigitalOnlyCart (กฎข้อ 24)", () => {
  it("ทุก line requires_shipping=false → digital-only", () => {
    expect(isDigitalOnlyCart(cartOf([voucher, voucher]))).toBe(true)
  })

  it.each([
    ["cart ผสม (กฎข้อ 24d)", [voucher, shirt]],
    ["ไม่ทราบค่า requires_shipping", [voucher, {}]],
    ["cart ว่าง", []],
  ])("%s → ไม่ใช่ digital-only", (_, items) => {
    expect(isDigitalOnlyCart(cartOf(items as Line[]))).toBe(false)
  })

  it("cart null → ไม่ใช่ digital-only", () => {
    expect(isDigitalOnlyCart(null)).toBe(false)
  })
})

describe("deliveryStepDone / checkoutStep", () => {
  it("digital-only ไม่ต้องมี shipping method (AC-3)", () => {
    expect(deliveryStepDone(cartOf([voucher]))).toBe(true)
  })

  it("cart ที่ต้องจัดส่งยังต้องมี shipping method", () => {
    expect(deliveryStepDone(cartOf([voucher, shirt]))).toBe(false)
    expect(
      deliveryStepDone(cartOf([shirt], { shipping_methods: [{ id: "sm_1" }] } as never))
    ).toBe(true)
  })

  it("digital-only ที่มีที่อยู่แล้ว → ไปขั้น payment ข้าม delivery", () => {
    expect(checkoutStep(cartOf([voucher], { shipping_address: address, email: "a@b.co" }))).toBe(
      "payment"
    )
  })

  it("สินค้าจัดส่งที่มีที่อยู่แต่ยังไม่มี shipping method → delivery", () => {
    expect(checkoutStep(cartOf([shirt], { shipping_address: address, email: "a@b.co" }))).toBe(
      "delivery"
    )
  })

  it("ยังไม่มีที่อยู่ → address", () => {
    expect(checkoutStep(cartOf([voucher]))).toBe("address")
  })
})

describe("setAddresses แบบ digital-only (กฎข้อ 24b)", () => {
  const billingForm = () => {
    const form = new FormData()
    form.set("digital_only", "1")
    form.set("checkout_country_code", "th")
    form.set("email", "a@example.com")
    form.set("billing_address.first_name", "สมชาย")
    form.set("billing_address.last_name", "ใจดี")
    form.set("billing_address.address_1", "99 ถนนสุขุมวิท")
    form.set("billing_address.company", "")
    form.set("billing_address.postal_code", "10110")
    form.set("billing_address.city", "วัฒนา")
    form.set("billing_address.country_code", "th")
    form.set("billing_address.province", "กรุงเทพฯ")
    form.set("billing_address.phone", "0812345678")
    return form
  }

  it("ตั้ง shipping_address = billing_address เดียวกัน แล้วไปขั้น payment ของ country ใน URL", async () => {
    update.mockResolvedValue({ cart: { id: "cart_1" } })
    const { setAddresses } = await import("@lib/data/cart")

    await setAddresses(null, billingForm())

    const body = update.mock.calls[0][1]
    expect(body.email).toBe("a@example.com")
    expect(body.billing_address).toMatchObject({
      address_1: "99 ถนนสุขุมวิท",
      postal_code: "10110",
      country_code: "th",
    })
    expect(body.shipping_address).toEqual(body.billing_address)
    expect(update).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith("/th/checkout?step=payment")
  })

  it.each(["/example.org", "//example.org", "https://example.org", "TH", ""])(
    "checkout_country_code ไม่ใช่รหัสประเทศ (%j) → redirect ภายในร้าน /checkout?step=payment (ไม่ open redirect)",
    async (cc) => {
      update.mockResolvedValue({ cart: { id: "cart_1" } })
      const { setAddresses } = await import("@lib/data/cart")
      const form = billingForm()
      form.set("checkout_country_code", cc)

      await setAddresses(null, form)

      expect(redirect).toHaveBeenCalledWith("/checkout?step=payment")
    }
  )

  it("flow ปกติ (ไม่มี digital_only) ยังไปขั้น delivery", async () => {
    update.mockResolvedValue({ cart: { id: "cart_1" } })
    const { setAddresses } = await import("@lib/data/cart")
    const form = new FormData()
    form.set("shipping_address.country_code", "th")
    form.set("shipping_address.address_1", "1 Sukhumvit")
    form.set("same_as_billing", "on")

    await setAddresses(null, form)

    expect(update.mock.calls[0][1].shipping_address.address_1).toBe("1 Sukhumvit")
    expect(redirect).toHaveBeenCalledWith("/th/checkout?step=delivery")
  })
})

describe("placeOrder redirect ใช้ countryCode จาก URL (กฎข้อ 24c)", () => {
  it("ส่ง countryCode มา → /<cc>/order/<id>/confirmed แม้ shipping_address ไม่มี country", async () => {
    complete.mockResolvedValue({ type: "order", order: { id: "order_1", shipping_address: null } })
    const { placeOrder } = await import("@lib/data/cart")

    await placeOrder("cart_1", undefined, "th")

    expect(redirect).toHaveBeenCalledWith("/th/order/order_1/confirmed")
  })

  it("countryCode จาก client ไม่ใช่รหัสประเทศ → ใช้ country ของ shipping_address (ไม่ open redirect)", async () => {
    complete.mockResolvedValue({
      type: "order",
      order: { id: "order_3", shipping_address: { country_code: "th" } },
    })
    const { placeOrder } = await import("@lib/data/cart")

    await placeOrder("cart_1", undefined, "/example.org")

    expect(redirect).toHaveBeenCalledWith("/th/order/order_3/confirmed")
  })

  it("ไม่ส่ง countryCode → ใช้ country ของ shipping_address แบบเดิม", async () => {
    complete.mockResolvedValue({
      type: "order",
      order: { id: "order_2", shipping_address: { country_code: "TH" } },
    })
    const { placeOrder } = await import("@lib/data/cart")

    await placeOrder("cart_1")

    expect(redirect).toHaveBeenCalledWith("/th/order/order_2/confirmed")
  })
})
