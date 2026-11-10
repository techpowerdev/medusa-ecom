import { beforeEach, describe, expect, it, vi } from "vitest"

// AF-3b (กฎ 23, review #119): Stripe card และ PromptPay ต้อง sync cookie `aff` ก่อนเรียก Stripe ที่ทำให้ webhook complete cart ได้
// — PromptPay ต้อง sync ก่อน retrievePaymentIntent เพื่อครอบทั้ง PI ที่รอสแกนอยู่ (requires_action, ใช้ QR เดิม) และที่ต้อง confirm ใหม่
const calls: string[] = []
const syncCartAffiliate = vi.fn(async () => {
  calls.push("sync")
})
vi.mock("@lib/data/cart", () => ({ syncCartAffiliate: (...a: unknown[]) => syncCartAffiliate(...(a as [])) }))

const cart = { id: "cart_1", metadata: { affiliate_token: "tok_ann" } }

beforeEach(() => {
  calls.length = 0
  syncCartAffiliate.mockClear()
})

describe("syncAffiliateBefore", () => {
  it("Stripe card: sync ก่อน confirmPayment แล้วคืนผลของ step", async () => {
    const { syncAffiliateBefore } = await import("@lib/util/checkout-affiliate")
    const confirmPayment = vi.fn(async () => {
      calls.push("confirmPayment")
      return { paymentIntent: { status: "succeeded" } }
    })
    const result = await syncAffiliateBefore(cart, confirmPayment)
    expect(calls).toEqual(["sync", "confirmPayment"])
    expect(syncCartAffiliate).toHaveBeenCalledWith("cart_1", { affiliate_token: "tok_ann" })
    expect(result).toEqual({ paymentIntent: { status: "succeeded" } })
  })

  it.each(["requires_action", "requires_payment_method"])(
    "PromptPay (PI %s): sync ก่อน retrievePaymentIntent",
    async (status) => {
      const { syncAffiliateBefore } = await import("@lib/util/checkout-affiliate")
      const retrievePaymentIntent = vi.fn(async () => {
        calls.push("retrievePaymentIntent")
        return { paymentIntent: { status } }
      })
      await syncAffiliateBefore(cart, retrievePaymentIntent)
      expect(calls).toEqual(["sync", "retrievePaymentIntent"])
    }
  )

  it("cart ไม่มี metadata → ส่ง null (ยัง sync เมื่อมี cookie)", async () => {
    const { syncAffiliateBefore } = await import("@lib/util/checkout-affiliate")
    await syncAffiliateBefore({ id: "cart_1" }, async () => null)
    expect(syncCartAffiliate).toHaveBeenCalledWith("cart_1", null)
  })
})
