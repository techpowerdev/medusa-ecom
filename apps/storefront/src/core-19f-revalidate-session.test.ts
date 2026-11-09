import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-19f (spec 01 กฎข้อ 75 a, AC-113): action สร้าง payment session ของ checkout เรียก `revalidateTag` ด้วย tag ของ cart
// ก่อนคืนผล — `router.refresh()` ของกฎข้อ 71 จึงได้ cart ที่มี session (ไม่ค้าง force-cache) ทั้งกรณีมี/ยังไม่มี collection
const fetchSdk = vi.fn()
const events: string[] = []
const revalidateTag = vi.fn((tag: string, _profile?: unknown) => {
  events.push(`revalidate:${tag}`)
})

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: { client: { fetch: (...a: unknown[]) => fetchSdk(...a) }, store: { cart: {} } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn(async (tag: string) => `${tag}-cache_1`),
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn() }))
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: (tag: string, profile?: unknown) => revalidateTag(tag, profile) }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const CARD = "pp_stripe_stripe"

// import ครั้งเดียว (cold import ของ `@lib/data/cart` ช้า — review #310 nit 3)
let initiatePaymentSession: typeof import("@lib/data/cart").initiatePaymentSession
beforeAll(async () => {
  ;({ initiatePaymentSession } = await import("@lib/data/cart"))
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ payment_collection: {} }), { status: 200 })))
})

describe("CORE-19f: initiatePaymentSession revalidate cart ก่อนคืนผล (กฎข้อ 75 a)", () => {
  it.each([
    ["มี payment collection แล้ว", { id: "cart_1", payment_collection: { id: "pay_col_1" } }],
    ["ยังไม่มี payment collection", { id: "cart_1" }],
  ])("%s → revalidateTag(tag ของ carts) ก่อน action คืนผล", async (_label, cart) => {
    fetchSdk.mockResolvedValueOnce({ payment_collection: { id: "pay_col_new" } })
    const result = await initiatePaymentSession(cart as never, { provider_id: CARD })
    events.push("returned")
    expect(result).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith("carts-cache_1", { expire: 0 })
    expect(events).toEqual(["revalidate:carts-cache_1", "returned"])
  })
})
