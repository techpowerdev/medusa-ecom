import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4i-b (spec 01 กฎข้อ 72, AC-110, Q-C2 = (ก)): action ชำระเงินคืน `{ ok: true } | { error }` ผ่าน helper กลางแทนการ throw
// — 401 → "unauthorized", 409 PAYMENT_ALREADY_COMPLETED → code นั้น, non-2xx อื่น/network → "failed" (spec 06 กฎข้อ 9 d/d2)
const fetchSdk = vi.fn()
const complete = vi.fn()
const addShippingMethod = vi.fn()
const getCartId = vi.fn()
const revalidateTag = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    client: { fetch: (...a: unknown[]) => fetchSdk(...a) },
    store: {
      cart: {
        complete: (...a: unknown[]) => complete(...a),
        addShippingMethod: (...a: unknown[]) => addShippingMethod(...a),
      },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("carts-t"),
  getCartId: () => getCartId(),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn() }))
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const PROMPTPAY = "pp_stripe-promptpay_stripe"
const CARD = "pp_stripe_stripe"
const cartWithCollection = { id: "cart_1", payment_collection: { id: "pay_col_1" } } as never
const cartWithoutCollection = { id: "cart_1" } as never

const respond = (status: number, body: unknown = {}) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))

// ผลของ POST /store/payment-collections/:id/payment-sessions → ผลที่ผู้เรียกใน UI ได้
const sessionCases: [string, () => void, unknown][] = [
  ["200", () => respond(200, { payment_collection: {} }), { ok: true }],
  ["401", () => respond(401, { type: "unauthorized", message: "Unauthorized" }), { error: "unauthorized" }],
  [
    "409 PAYMENT_ALREADY_COMPLETED",
    () => respond(409, { type: "conflict", code: "PAYMENT_ALREADY_COMPLETED", message: "x" }),
    { error: "PAYMENT_ALREADY_COMPLETED" },
  ],
  ["409 invalid_state_error (ไม่มี code ของเรา)", () => respond(409, { type: "invalid_state_error" }), { error: "failed" }],
  ["403 (ไม่ใช่ทาง login — กฎข้อ 9 d2)", () => respond(403, {}), { error: "failed" }],
  ["400", () => respond(400, { type: "invalid_data" }), { error: "failed" }],
  ["500", () => respond(500, { type: "unknown_error" }), { error: "failed" }],
  ["network", () => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed"))), { error: "failed" }],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  getCartId.mockResolvedValue("cart_1")
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("startPaymentSession (หน้า /account/orders/:id/pay) ผ่าน helper กลาง", () => {
  it.each(sessionCases)("%s", async (_label, arrange, expected) => {
    arrange()
    const { startPaymentSession } = await import("@lib/data/payment")
    await expect(startPaymentSession("pay_col_1", CARD)).resolves.toEqual(expected)
  })
})

describe("initiatePaymentSession (checkout) ผ่าน helper กลาง — ผลรูปแบบเดียวกับหน้า pay", () => {
  it.each(sessionCases)("%s", async (_label, arrange, expected) => {
    arrange()
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await expect(initiatePaymentSession(cartWithCollection, { provider_id: CARD })).resolves.toEqual(expected)
  })

  it("สำเร็จ → revalidate cart และส่ง data ของกฎข้อ 5 (บัตร = card)", async () => {
    respond(200)
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await initiatePaymentSession(cartWithCollection, { provider_id: CARD })
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe("http://backend/store/payment-collections/pay_col_1/payment-sessions")
    expect(JSON.parse(init.body)).toEqual({
      provider_id: CARD,
      data: { payment_method_types: ["card"] },
    })
    expect(revalidateTag).toHaveBeenCalledWith("carts-t", { expire: 0 })
    // no-store ใน action ทำให้ cart หลัง action ค้างค่าเดิม (ดูหมายเหตุใน createPaymentSession)
    expect(init.cache).toBeUndefined()
  })

  it("ล้ม → ไม่ revalidate", async () => {
    respond(500)
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await initiatePaymentSession(cartWithCollection, { provider_id: CARD })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("cart ยังไม่มี payment collection → สร้างด้วย SDK ก่อน แล้วสร้าง session ใน collection นั้น", async () => {
    fetchSdk.mockResolvedValueOnce({ payment_collection: { id: "pay_col_new" } })
    respond(200)
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await expect(initiatePaymentSession(cartWithoutCollection, { provider_id: PROMPTPAY })).resolves.toEqual({ ok: true })
    expect(fetchSdk).toHaveBeenCalledWith(
      "/store/payment-collections",
      expect.objectContaining({ method: "POST", body: { cart_id: "cart_1" } })
    )
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("/pay_col_new/payment-sessions")
  })

  it.each([
    ["FetchError 401", new FetchError("Unauthorized", "Unauthorized", 401), "unauthorized"],
    ["FetchError 500", new FetchError("x", "Internal Server Error", 500), "failed"],
    ["network", new TypeError("fetch failed"), "failed"],
  ])("สร้าง collection ล้ม (%s) → { error: %s } ไม่ throw", async (_label, error, expected) => {
    fetchSdk.mockRejectedValueOnce(error)
    vi.stubGlobal("fetch", vi.fn())
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await expect(initiatePaymentSession(cartWithoutCollection, { provider_id: CARD })).resolves.toEqual({ error: expected })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("renewPromptPaySession ผ่าน helper กลาง", () => {
  it.each(sessionCases)("%s", async (_label, arrange, expected) => {
    arrange()
    const { renewPromptPaySession } = await import("@lib/data/cart")
    await expect(renewPromptPaySession(cartWithCollection, PROMPTPAY)).resolves.toEqual(expected)
  })

  it("ไม่มี payment collection → { error: \"failed\" } ไม่ยิง request", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const { renewPromptPaySession } = await import("@lib/data/cart")
    await expect(renewPromptPaySession(cartWithoutCollection, PROMPTPAY)).resolves.toEqual({ error: "failed" })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("placeOrder คืน { error } แทนการ throw", () => {
  const place = async () => (await import("@lib/data/cart")).placeOrder("cart_1")

  it.each([
    ["409 FLASH_SOLD_OUT", new FetchError("This flash sale is sold out", "Conflict", 409), "FLASH_SOLD_OUT"],
    [
      "409 PROMOTION_NOT_COMBINABLE",
      new FetchError("This promotion can't be combined with the promotions already on the cart", "Conflict", 409),
      "PROMOTION_NOT_COMBINABLE",
    ],
    ["FetchError 401", new FetchError("Unauthorized", "Unauthorized", 401), "unauthorized"],
    ["FetchError 400", new FetchError("Payment sessions are required", "Bad Request", 400), "failed"],
    ["network", new TypeError("fetch failed"), "failed"],
  ])("%s → { error: %s }", async (_label, error, expected) => {
    complete.mockRejectedValueOnce(error)
    await expect(place()).resolves.toEqual({ error: expected })
  })

  it("Medusa คืน type cart (ชำระไม่ผ่าน ไม่ได้ order) → { error: \"failed\" }", async () => {
    complete.mockResolvedValueOnce({ type: "cart", cart: { id: "cart_1" }, error: { message: "x" } })
    await expect(place()).resolves.toEqual({ error: "failed" })
  })

  it("ไม่มี cart id → { error: \"failed\" } ไม่ throw", async () => {
    getCartId.mockResolvedValueOnce(undefined)
    const { placeOrder } = await import("@lib/data/cart")
    await expect(placeOrder()).resolves.toEqual({ error: "failed" })
  })

  it("ได้ order → redirect ของ Next ยัง throw ได้", async () => {
    complete.mockResolvedValueOnce({ type: "order", order: { id: "order_1", shipping_address: { country_code: "TH" } } })
    await expect(place()).rejects.toThrow("REDIRECT /th/order/order_1/confirmed")
  })
})

describe("setShippingMethod คืนผลแทนการ throw", () => {
  const choose = async () =>
    (await import("@lib/data/cart")).setShippingMethod({ cartId: "cart_1", shippingMethodId: "so_1" })

  it("สำเร็จ → { ok: true } และ revalidate", async () => {
    addShippingMethod.mockResolvedValueOnce({ cart: {} })
    await expect(choose()).resolves.toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith("carts-t", { expire: 0 })
  })

  it.each([
    ["FetchError 401", new FetchError("Unauthorized", "Unauthorized", 401), "unauthorized"],
    ["FetchError 500", new FetchError("x", "Internal Server Error", 500), "failed"],
    ["network", new TypeError("fetch failed"), "failed"],
  ])("%s → { error: %s }", async (_label, error, expected) => {
    addShippingMethod.mockRejectedValueOnce(error)
    await expect(choose()).resolves.toEqual({ error: expected })
  })
})
