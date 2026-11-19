import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import { isDigitalOnlyCart } from "@lib/util/digital-checkout"

// EV-7d (spec 02 กฎข้อ 28, AC-42): ยอดรวมของ cart digital-only ไม่มีแถวค่าจัดส่ง, digital-only ตัดสินจาก cart ฝั่ง server
// และ redirect หลัง complete / setAddresses ใช้ country จาก URL ที่ผ่าน safeCountryCode เท่านั้น
const retrieve = vi.fn()
const update = vi.fn()
const complete = vi.fn()
const redirect = vi.fn()

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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }))

const voucher = { requires_shipping: false }
const shirt = { requires_shipping: true }
const serverCart = (...items: { requires_shipping: boolean }[]) =>
  retrieve.mockResolvedValue({ cart: { id: "cart_1", items } })

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue({ cart: { id: "cart_1" } })
})

describe("CartTotals (กฎข้อ 28a)", () => {
  const render = async (items?: { requires_shipping: boolean }[]) => {
    const CartTotals = (await import("@modules/common/components/cart-totals")).default
    return renderToStaticMarkup(
      createElement(CartTotals, {
        totals: { currency_code: "thb", original_item_total: 500, total: 500, tax_total: 32.71, items },
      })
    )
  }

  it("digital-only → ไม่มีแถวค่าจัดส่งและไม่มีคำว่าค่าจัดส่งเลย แต่ยังมีภาษี", async () => {
    const html = await render([voucher, voucher])
    expect(html).not.toContain("ค่าจัดส่ง")
    expect(html).not.toContain('data-testid="cart-shipping"')
    expect(html).toContain("ยอดรวมสินค้า (รวม VAT)")
    expect(html).toContain('data-testid="cart-taxes"')
  })

  it.each([
    ["cart ผสม", [voucher, shirt]],
    ["สินค้าจัดส่งล้วน", [shirt]],
    ["ไม่รู้รายการสินค้า", undefined],
  ])("%s → ยังมีแถวค่าจัดส่ง", async (_, items) => {
    const html = await render(items)
    expect(html).toContain('data-testid="cart-shipping"')
    expect(html).toContain("ยอดรวมสินค้า (รวม VAT)")
  })
})

describe("CartTotals เมื่อ cart digital-only ยังมีค่าจัดส่งเก็บจริง (review #320)", () => {
  // voucher + t-shirt เลือก Standard แล้วลบ t-shirt: Medusa 2.22.1 ไม่ลบ shipping method — ยอดรวมยังรวมค่าจัดส่ง
  // CORE-57 (กฎข้อ 115c): เงื่อนไขและค่าของแถวใช้ original_shipping_total (รวม VAT = ราคา option)
  it("original_shipping_total > 0 → คงแถวค่าจัดส่ง ไม่ให้ยอดรวมมีเงินที่ไม่มีแถวอธิบาย", async () => {
    const CartTotals = (await import("@modules/common/components/cart-totals")).default
    const html = renderToStaticMarkup(
      createElement(CartTotals, {
        totals: {
          currency_code: "thb",
          original_item_total: 500,
          original_shipping_total: 10,
          total: 510,
          items: [voucher],
        },
      })
    )
    expect(html).toContain('data-testid="cart-shipping"')
    expect(html).toMatch(/data-testid="cart-shipping"[^>]*data-value="10"/)
    expect(html).toContain("ยอดรวมสินค้า (รวม VAT)")
  })
})

describe("isDigitalOnlyCart (กฎข้อ 28b)", () => {
  it("รับเฉพาะ cart — ผลมาจาก requires_shipping ไม่มี parameter flag", () => {
    expect(isDigitalOnlyCart.length).toBe(1)
    expect(isDigitalOnlyCart({ items: [voucher] } as never)).toBe(true)
    expect(isDigitalOnlyCart({ items: [voucher, shirt] } as never)).toBe(false)
  })
})

describe("setAddresses ตัดสิน digital-only จาก cart ฝั่ง server (กฎข้อ 28b, 28c)", () => {
  const billingForm = (cc = "th") => {
    const form = new FormData()
    form.set("checkout_country_code", cc)
    form.set("email", "a@example.com")
    form.set("billing_address.address_1", "99 ถนนสุขุมวิท")
    form.set("billing_address.country_code", "th")
    form.set("billing_address.first_name", "สมชาย")
    form.set("billing_address.last_name", "ใจดี")
    form.set("billing_address.postal_code", "10110")
    form.set("billing_address.city", "วัฒนา")
    return form
  }
  const shippingForm = (cc = "th") => {
    const form = new FormData()
    form.set("checkout_country_code", cc)
    form.set("email", "a@example.com")
    form.set("shipping_address.address_1", "1 Sukhumvit")
    form.set("shipping_address.country_code", "th")
    form.set("shipping_address.first_name", "Somchai")
    form.set("shipping_address.last_name", "Jaidee")
    form.set("shipping_address.postal_code", "10110")
    form.set("shipping_address.city", "Bangkok")
    form.set("same_as_billing", "on")
    return form
  }
  const submit = async (form: FormData) =>
    (await import("@lib/data/cart")).setAddresses(null, form)

  it("cart ใน server เป็น digital-only → ไม่ต้องมี flag จาก form ก็ใช้ที่อยู่ใบกำกับภาษีเป็น shipping_address", async () => {
    serverCart(voucher)

    await submit(billingForm())

    const body = update.mock.calls[0][1]
    expect(body.shipping_address).toEqual(body.billing_address)
    expect(body.shipping_address.address_1).toBe("99 ถนนสุขุมวิท")
    expect(redirect).toHaveBeenCalledWith("/th/checkout?step=payment")
  })

  it("อ่าน cart เฉพาะ requires_shipping ของ line ด้วย token ของลูกค้า", async () => {
    serverCart(voucher)

    await submit(billingForm())

    expect(retrieve).toHaveBeenCalledWith(
      "cart_1",
      { fields: "id,items.requires_shipping" },
      { authorization: "Bearer t" }
    )
  })

  it("client ส่ง digital_only=1 มาแต่ cart ใน server ต้องจัดส่ง → ไม่เชื่อ flag ใช้ flow ปกติ", async () => {
    serverCart(voucher, shirt)
    const form = shippingForm()
    form.set("digital_only", "1")

    await submit(form)

    expect(update.mock.calls[0][1].shipping_address.address_1).toBe("1 Sukhumvit")
    expect(redirect).toHaveBeenCalledWith("/th/checkout?step=delivery")
  })

  it.each([
    ["cart กลายเป็น digital-only แต่ฟอร์มเป็นที่อยู่จัดส่ง", [voucher], shippingForm],
    ["cart กลายเป็นต้องจัดส่งแต่ฟอร์มเป็นที่อยู่ใบกำกับภาษี", [voucher, shirt], billingForm],
  ])("%s → ไม่บันทึกที่อยู่ว่าง และแจ้งให้โหลดหน้าใหม่", async (_, items, form) => {
    serverCart(...items)

    const message = await submit(form())

    expect(update).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(message).toMatch(/[฀-๿]/)
  })

  it.each([
    ["digital-only", [voucher], billingForm, "billing_address.address_1"],
    ["ต้องจัดส่ง", [shirt], shippingForm, "shipping_address.address_1"],
  ])("%s: ฟอร์มถูกแบบแต่ที่อยู่ว่าง → ไม่บอกว่าตะกร้าเปลี่ยนแปลง (review #320)", async (_, items, form, field) => {
    serverCart(...items)
    const data = form()
    data.set(field, "")

    const message = (await submit(data)) ?? ""
    expect(message).not.toMatch(/เปลี่ยนแปลง/)
    // CORE-52 (กฎข้อ 110b): ช่องบังคับว่าง → ข้อความให้กรอกให้ครบ ไม่บันทึกทับ cart
    expect(message).toMatch(/[฀-๿]/)
    expect(update).not.toHaveBeenCalled()
  })

  it("อ่าน cart แล้ว 401 → ให้เข้าสู่ระบบใหม่ ไม่บันทึกที่อยู่", async () => {
    retrieve.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))

    expect(await submit(billingForm())).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(update).not.toHaveBeenCalled()
  })

  it("flow ปกติไป delivery ของ country ใน URL ไม่ใช่ country ของที่อยู่จัดส่ง", async () => {
    serverCart(shirt)

    await submit(shippingForm("sg"))

    expect(redirect).toHaveBeenCalledWith("/sg/checkout?step=delivery")
  })

  it.each(["/example.org", "//example.org", "TH", ""])(
    "flow ปกติ country ใน URL ไม่ผ่าน safeCountryCode (%j) → path ภายในร้าน",
    async (cc) => {
      serverCart(shirt)

      await submit(shippingForm(cc))

      expect(redirect).toHaveBeenCalledWith("/checkout?step=delivery")
    }
  )
})

describe("placeOrder ไม่อ่าน country จาก shipping_address (กฎข้อ 28c)", () => {
  const order = { id: "order_1", shipping_address: { country_code: "sg" } }
  const place = async (countryCode?: string) =>
    (await import("@lib/data/cart")).placeOrder("cart_1", undefined, countryCode)

  it("ใช้ country จาก URL แม้ shipping_address เป็นประเทศอื่น", async () => {
    complete.mockResolvedValue({ type: "order", order })

    await place("th")

    expect(redirect).toHaveBeenCalledWith("/th/order/order_1/confirmed")
  })

  it.each([undefined, "/example.org", "TH"])(
    "country จาก URL ใช้ไม่ได้ (%j) → path ภายในร้าน ไม่ fallback ไป shipping_address",
    async (cc) => {
      complete.mockResolvedValue({ type: "order", order })

      await place(cc)

      expect(redirect).toHaveBeenCalledWith("/order/order_1/confirmed")
    }
  )
})

describe("static: ทุกทางหลังชำระส่ง country จาก URL ให้ placeOrder (กฎข้อ 28c)", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8")
  const placeOrderCalls = (source: string) => source.match(/\bplaceOrder\([^\n]*/g) ?? []

  it.each([
    ["บัตร + manual", "modules/checkout/components/payment-button/index.tsx", 2],
    ["พร้อมเพย์", "modules/checkout/components/promptpay-payment/index.tsx", 1],
    ["redirect กลับจาก Stripe", "app/api/payment-return/route.ts", 1],
  ])("%s", (_, file, count) => {
    const calls = placeOrderCalls(read(file))
    expect(calls).toHaveLength(count)
    for (const call of calls) expect(call).toMatch(/countryCode/)
  })

  it("payment-return ผ่าน safeCountryCode ก่อนประกอบ path", () => {
    expect(read("app/api/payment-return/route.ts")).toMatch(
      /safeCountryCode\(searchParams\.get\("country_code"\)\)/
    )
  })

  it("lib/data/cart.ts ไม่ประกอบ redirect จาก country ของที่อยู่ และไม่รับ flag digital_only", () => {
    const source = read("lib/data/cart.ts")
    expect(source).not.toMatch(/shipping_address\?\.country_code/)
    expect(source).not.toMatch(/redirect\(\s*`\/\$\{formData\.get/)
    expect(source).not.toMatch(/digital_only/)
  })

  it("ฟอร์มที่อยู่ทั้งสองแบบส่ง country ของ URL และไม่มี hidden flag", () => {
    const source = read("modules/checkout/components/addresses/index.tsx")
    expect(source.match(/name="checkout_country_code"/g)).toHaveLength(2)
    expect(source).not.toMatch(/digital_only/)
  })
})
