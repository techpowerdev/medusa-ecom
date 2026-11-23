import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-48 (spec 01 กฎข้อ 106a, AC-143): `updateLineItem` แยก 400 stock ไม่พอของ Medusa เป็น code ของตัวเอง
// (mock เหมือน `core-4i-cart-actions.test.ts`); CORE-82 (กฎข้อ 140, ADR-028): ผ่าน medusaFetch — ตัดสินจาก code ใน body
const fetchMock = vi.fn()
const getCartId = vi.fn()
const getAuthHeaders = vi.fn()
const revalidateTag = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  MEDUSA_PUBLISHABLE_KEY: "pk_test",
  sdk: { store: { cart: {} } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: () => getAuthHeaders(),
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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const cart = () => import("@lib/data/cart")
const MESSAGE = "Some variant does not have the required inventory"
const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  getCartId.mockResolvedValue("cart_1")
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => vi.unstubAllGlobals())

describe("updateLineItem — stock ไม่พอ (AC-143)", () => {
  it("400 code insufficient_inventory → { error: \"INSUFFICIENT_INVENTORY\" } ไม่ revalidate", async () => {
    respond(400, { type: "not_allowed", code: "insufficient_inventory", message: MESSAGE })
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 10 })).resolves.toEqual({
      error: "INSUFFICIENT_INVENTORY",
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://backend/store/carts/cart_1/line-items/line_1")
    expect(JSON.parse(init.body)).toEqual({ quantity: 10 })
    expect(init.headers.authorization).toBe("Bearer t")
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it.each([
    ["400 ข้อความของ Medusa แต่ไม่มี code (ไม่เทียบข้อความแล้ว — CORE-82)", 400, { type: "not_allowed", message: MESSAGE }, "failed"],
    ["400 ข้อความอื่น", 400, { type: "invalid_data", message: "Invalid request" }, "failed"],
    ["500 code เดียวกัน", 500, { type: "unknown_error", code: "insufficient_inventory", message: MESSAGE }, "failed"],
    ["401", 401, { type: "unauthorized", message: "Unauthorized" }, "unauthorized"],
  ])("%s → { error: %s } เดิม", async (_label, status, body, expected) => {
    respond(status, body)
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 10 })).resolves.toEqual({
      error: expected,
    })
  })
})
