import { HttpTypes } from "@medusajs/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkoutRedirectStep,
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

// CORE-35 (spec 01 กฎข้อ 93, AC-129): ส่งรายการ option ที่กรองแล้ว (กฎข้อ 89) → ใช้ option ที่เลือกในรายการนั้น
describe("deliveryStepDone(cart, options) — รายการที่กรองแล้ว (กฎข้อ 93)", () => {
  const standard = { id: "so_standard" }
  const digital = { id: "so_digital" }
  const filtered = [standard] // cart ที่ต้องจัดส่ง: Digital delivery ถูกกรองออก

  it("cart ต้องจัดส่ง + method ล่าสุดเป็น Digital delivery ที่ไม่อยู่ในรายการ → ยังไม่เสร็จ", () => {
    const cart = cartOf([shirt], {
      shipping_methods: [{ id: "sm_1", shipping_option_id: digital.id }],
    } as never)
    expect(deliveryStepDone(cart, filtered)).toBe(false)
  })

  it("method Standard อยู่ในรายการ → เสร็จ", () => {
    const cart = cartOf([shirt], {
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never)
    expect(deliveryStepDone(cart, filtered)).toBe(true)
  })

  it("digital-only ไม่มี method → เสร็จ (EV-7c)", () => {
    expect(deliveryStepDone(cartOf([voucher]), [])).toBe(true)
  })

  it("ไม่ส่งรายการ → พฤติกรรมเดิม (มี method = เสร็จ)", () => {
    const cart = cartOf([shirt], {
      shipping_methods: [{ id: "sm_1", shipping_option_id: digital.id }],
    } as never)
    expect(deliveryStepDone(cart)).toBe(true)
  })
})

// CORE-41 (spec 01 กฎข้อ 99, AC-135): ขั้นแรกที่ยังไม่เสร็จ — ส่งรายการที่กรองแล้ว → delivery ใช้ deliveryStepDone(cart, options)
describe("checkoutStep(cart, options) — ขั้นแรกที่ยังไม่เสร็จ (กฎข้อ 99)", () => {
  const standard = { id: "so_standard" }
  const digital = { id: "so_digital" }
  const filtered = [standard]
  const withAddress = { shipping_address: address, email: "a@b.co" }

  it("ไม่มีที่อยู่ + method Standard อยู่ในรายการ → address", () => {
    const cart = cartOf([shirt], {
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never)
    expect(checkoutStep(cart, filtered)).toBe("address")
  })

  it("มีที่อยู่แต่ไม่มีอีเมล → address", () => {
    const cart = cartOf([shirt], {
      shipping_address: address,
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never)
    expect(checkoutStep(cart, filtered)).toBe("address")
  })

  it("มีที่อยู่ + method Digital ค้างที่ไม่อยู่ในรายการ → delivery", () => {
    const cart = cartOf([shirt], {
      ...withAddress,
      shipping_methods: [{ id: "sm_1", shipping_option_id: digital.id }],
    } as never)
    expect(checkoutStep(cart, filtered)).toBe("delivery")
  })

  it("มีที่อยู่ + Standard อยู่ในรายการ → payment", () => {
    const cart = cartOf([shirt], {
      ...withAddress,
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never)
    expect(checkoutStep(cart, filtered)).toBe("payment")
  })

  it("digital-only: ไม่มีที่อยู่ → address, มีที่อยู่ → payment (ข้าม delivery)", () => {
    expect(checkoutStep(cartOf([voucher]), [])).toBe("address")
    expect(checkoutStep(cartOf([voucher], withAddress), [])).toBe("payment")
  })
})

// CORE-45 (spec 01 กฎข้อ 103, AC-139): step ที่ใช้ไม่ได้ → ขั้นแรกที่ยังไม่เสร็จ; ปลายทางต้องไม่ redirect ซ้ำ (ไม่วน)
describe("checkoutRedirectStep(step, cart, options) — step ที่ใช้ไม่ได้ (กฎข้อ 103)", () => {
  const standard = { id: "so_standard" }
  const digital = { id: "so_digital" }
  const filtered = [standard]
  const withAddress = { shipping_address: address, email: "a@b.co" }
  const fixtures: Record<string, HttpTypes.StoreCart> = {
    "ไม่มีที่อยู่": cartOf([shirt], {
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never),
    "มีที่อยู่ ไม่มี method": cartOf([shirt], withAddress),
    "มีที่อยู่ + method ค้าง": cartOf([shirt], {
      ...withAddress,
      shipping_methods: [{ id: "sm_1", shipping_option_id: digital.id }],
    } as never),
    "มีที่อยู่ + Standard": cartOf([shirt], {
      ...withAddress,
      shipping_methods: [{ id: "sm_1", shipping_option_id: standard.id }],
    } as never),
    "digital-only ไม่มีที่อยู่": cartOf([voucher]),
    "digital-only มีที่อยู่": cartOf([voucher], withAddress),
  }
  const optionsOf = (name: string) => (name.startsWith("digital-only") ? [] : filtered)
  const steps = [undefined, "", "foo", "REVIEW", "Delivery", "address", "delivery", "payment", "review"]

  it.each([undefined, "foo", "REVIEW"])("step=%s + ไม่มีที่อยู่ → address", (step) => {
    expect(checkoutRedirectStep(step, fixtures["ไม่มีที่อยู่"], filtered)).toBe("address")
  })

  it.each([undefined, "foo", "REVIEW"])("step=%s + มีที่อยู่ + Standard → payment", (step) => {
    expect(checkoutRedirectStep(step, fixtures["มีที่อยู่ + Standard"], filtered)).toBe("payment")
  })

  it("delivery + ไม่มีที่อยู่ → address", () => {
    expect(checkoutRedirectStep("delivery", fixtures["ไม่มีที่อยู่"], filtered)).toBe("address")
  })

  it.each(["มีที่อยู่ ไม่มี method", "มีที่อยู่ + method ค้าง", "มีที่อยู่ + Standard"])(
    "delivery + %s → ไม่ redirect (กลับมาเปลี่ยนวิธีส่งได้)",
    (name) => {
      expect(checkoutRedirectStep("delivery", fixtures[name], filtered)).toBeNull()
    }
  )

  it("delivery + digital-only: ไม่มีที่อยู่ → address, มีที่อยู่ → payment", () => {
    expect(checkoutRedirectStep("delivery", fixtures["digital-only ไม่มีที่อยู่"], [])).toBe("address")
    expect(checkoutRedirectStep("delivery", fixtures["digital-only มีที่อยู่"], [])).toBe("payment")
  })

  it.each(Object.keys(fixtures))("address + %s → ไม่ redirect", (name) => {
    expect(checkoutRedirectStep("address", fixtures[name], optionsOf(name))).toBeNull()
  })

  it.each(Object.keys(fixtures))("payment/review + %s → ผลเดียวกับกฎข้อ 99 (AC-135)", (name) => {
    const cart = fixtures[name]
    const options = optionsOf(name)
    const first = checkoutStep(cart, options)
    const expected = first === "payment" ? null : first
    expect(checkoutRedirectStep("payment", cart, options)).toBe(expected)
    expect(checkoutRedirectStep("review", cart, options)).toBe(expected)
  })

  it("payment/review + มีที่อยู่ + method ค้าง → delivery (AC-129)", () => {
    expect(checkoutRedirectStep("payment", fixtures["มีที่อยู่ + method ค้าง"], filtered)).toBe("delivery")
    expect(checkoutRedirectStep("review", fixtures["มีที่อยู่ + method ค้าง"], filtered)).toBe("delivery")
  })

  it("ทุก fixture × ทุก step: ปลายทางของ redirect ไม่ redirect ซ้ำ (ไม่วน)", () => {
    for (const [name, cart] of Object.entries(fixtures)) {
      for (const step of steps) {
        const target = checkoutRedirectStep(step, cart, optionsOf(name))
        if (target !== null) {
          expect(checkoutRedirectStep(target, cart, optionsOf(name)), `${name} / ${step} → ${target}`).toBeNull()
        }
      }
    }
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
