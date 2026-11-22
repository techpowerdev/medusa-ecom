import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// PAY-12 (spec 06 กฎข้อ 14; qa #481 D-2): กลับจาก /api/payment-return ด้วย /<cc>/checkout?step=review&cart_id=<cart>
// แล้ว cart นั้นถูก complete ไปแล้ว (webhook ระหว่างลูกค้า login ใหม่) → หน้า order confirmed ของ order ที่ผูก cart นั้น ไม่ใช่ 404
const fetch = vi.fn()
const retrieveCartData = vi.fn()
const findOrder = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetch(...a) } } }))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [fetch, retrieveCartData, findOrder]) fn.mockReset()
})

describe("findOrderIdByCart", () => {
  it("หา order ของลูกค้าที่ cart.id ตรง (list ของ Medusa ล่าสุดก่อน, field cart.id)", async () => {
    fetch.mockResolvedValue({ orders: [{ id: "order_2", cart: { id: "cart_other" } }, { id: "order_1", cart: { id: "cart_pay" } }] })
    const { findOrderIdByCart } = await import("@lib/data/orders")
    await expect(findOrderIdByCart("cart_pay")).resolves.toBe("order_1")
    expect(fetch).toHaveBeenCalledWith(
      "/store/orders",
      expect.objectContaining({
        method: "GET",
        query: expect.objectContaining({ order: "-created_at", fields: "id,cart.id" }),
        headers: { authorization: "Bearer t" },
      })
    )
  })

  it("ไม่พบ / API ล้ม → null", async () => {
    fetch.mockResolvedValueOnce({ orders: [{ id: "order_2", cart: null }] })
    const { findOrderIdByCart } = await import("@lib/data/orders")
    await expect(findOrderIdByCart("cart_pay")).resolves.toBeNull()
    fetch.mockRejectedValueOnce(new FetchError("x", "Internal Server Error", 500))
    await expect(findOrderIdByCart("cart_pay")).resolves.toBeNull()
  })
})

describe("หน้า /checkout?step=review&cart_id= (กลับจาก payment-return)", () => {
  const open = async (cart: unknown, cartId?: string) => {
    vi.resetModules()
    vi.doMock("@lib/data/cart", () => ({ retrieveCart: (...a: unknown[]) => retrieveCartData(...a) }))
    vi.doMock("@lib/data/orders", () => ({ findOrderIdByCart: (...a: unknown[]) => findOrder(...a) }))
    vi.doMock("@lib/data/customer", () => ({ retrieveCustomer: vi.fn().mockResolvedValue(null) }))
    vi.doMock("@modules/checkout/components/payment-wrapper", () => ({ default: () => null }))
    vi.doMock("@modules/checkout/templates/checkout-form", () => ({ default: () => null }))
    vi.doMock("@modules/checkout/templates/checkout-summary", () => ({ default: () => null }))
    retrieveCartData.mockResolvedValue(cart)
    const { default: Checkout } = await import("./app/[countryCode]/(checkout)/checkout/page")
    return Checkout({
      params: Promise.resolve({ countryCode: "th" }),
      searchParams: Promise.resolve(cartId === undefined ? { step: "review" } : { step: "review", cart_id: cartId }),
    })
  }

  it("ไม่มี cart (cookie ถูกล้างตอนไม่มี jwt, restore ข้าม cart ที่ complete) + มี order → หน้า confirmed", async () => {
    findOrder.mockResolvedValue("order_1")
    await expect(open(null, "cart_pay")).rejects.toThrow("REDIRECT /th/order/order_1/confirmed")
    expect(findOrder).toHaveBeenCalledWith("cart_pay")
  })

  it("cart ใน cookie complete แล้ว (jwt เสียแต่ cookie อยู่) → หน้า confirmed ไม่แสดง review ของ cart ที่ complete", async () => {
    findOrder.mockResolvedValue("order_1")
    await expect(open({ id: "cart_pay", completed_at: "2026-11-22", items: [{ id: "i" }] }, "cart_pay")).rejects.toThrow(
      "REDIRECT /th/order/order_1/confirmed"
    )
  })

  it("ไม่มี cart และหา order ไม่พบ → รายการคำสั่งซื้อ ไม่ใช่ 404", async () => {
    findOrder.mockResolvedValue(null)
    await expect(open(null, "cart_pay")).rejects.toThrow("REDIRECT /th/account/orders")
  })

  it("cart ยังไม่ complete → render ขั้น review ตามเดิม ไม่ค้นหา order", async () => {
    await expect(open({ id: "cart_pay", completed_at: null, items: [{ id: "i" }] }, "cart_pay")).resolves.toBeTruthy()
    expect(findOrder).not.toHaveBeenCalled()
  })

  it.each([undefined, "../x", "cart_pay&x=1", "order_1"])("cart_id %j ไม่ผ่าน/ไม่มี + ไม่มี cart → 404 ตามเดิม", async (cartId) => {
    await expect(open(null, cartId)).rejects.toThrow("NOT_FOUND")
    expect(findOrder).not.toHaveBeenCalled()
  })
})
