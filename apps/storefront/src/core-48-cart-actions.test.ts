import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"


// CORE-48 (spec 01 กฎข้อ 106a, AC-143): `updateLineItem` แยก 400 stock ไม่พอของ Medusa เป็น code ของตัวเอง
// (mock เหมือน `core-4i-cart-actions.test.ts`)
const update = vi.fn()
const updateLineItemSdk = vi.fn()
const getCartId = vi.fn()
const getAuthHeaders = vi.fn()
const revalidateTag = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    store: {
      cart: {
        update: (...a: unknown[]) => update(...a),
        updateLineItem: (...a: unknown[]) => updateLineItemSdk(...a),
      },
    },
  },
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

beforeEach(() => {
  vi.clearAllMocks()
  getCartId.mockResolvedValue("cart_1")
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("updateLineItem — stock ไม่พอ (AC-143)", () => {
  it.each([
    ["FetchError 400 ข้อความของ Medusa", () => new FetchError(MESSAGE, "Bad Request", 400)],
    ["400 code insufficient_inventory", () => ({ status: 400, code: "insufficient_inventory", message: "x" })],
  ])("%s → { error: \"INSUFFICIENT_INVENTORY\" } ไม่ revalidate", async (_label, makeError) => {
    updateLineItemSdk.mockRejectedValue(makeError())
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 10 })).resolves.toEqual({
      error: "INSUFFICIENT_INVENTORY",
    })
    expect(updateLineItemSdk).toHaveBeenCalledWith("cart_1", "line_1", { quantity: 10 }, {}, { authorization: "Bearer t" })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it.each([
    ["400 ข้อความอื่น", () => new FetchError("Invalid request", "Bad Request", 400), "failed"],
    ["500 ข้อความเดียวกัน", () => new FetchError(MESSAGE, "Internal Server Error", 500), "failed"],
    ["401", () => new FetchError("Unauthorized", "Unauthorized", 401), "unauthorized"],
  ])("%s → { error: %s } เดิม", async (_label, makeError, expected) => {
    updateLineItemSdk.mockRejectedValue(makeError())
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 10 })).resolves.toEqual({
      error: expected,
    })
  })
})
