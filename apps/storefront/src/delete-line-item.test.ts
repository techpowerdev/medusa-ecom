import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-19d (spec 01 กฎข้อ 68, AC-104): Next ใน production ซ่อน error ที่ throw จาก server action
// → `deleteLineItem` ต้องคืนผลแบบมีโครงสร้างแทนการ throw เพื่อให้ client แยก 401/403 ได้
const deleteLineItemSdk = vi.fn()
const getCartId = vi.fn()
const revalidateTag = vi.fn()
const getAuthHeaders = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: { store: { cart: { deleteLineItem: (...a: unknown[]) => deleteLineItemSdk(...a) } } },
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

const run = async (lineId = "line_1") => {
  const { deleteLineItem } = await import("@lib/data/cart")
  return deleteLineItem(lineId)
}

describe("deleteLineItem คืนผลแบบมีโครงสร้าง (CORE-19d, AC-104)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCartId.mockResolvedValue("cart_1")
    getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("สำเร็จ → { ok: true } และ revalidate cache ของ cart", async () => {
    deleteLineItemSdk.mockResolvedValue({ deleted: true })
    await expect(run()).resolves.toEqual({ ok: true })
    expect(deleteLineItemSdk).toHaveBeenCalledWith("cart_1", "line_1", {}, { authorization: "Bearer t" })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it.each([401, 403])("SDK throw FetchError %i → { error: \"unauthorized\" } ไม่ throw", async (status) => {
    deleteLineItemSdk.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", status))
    await expect(run()).resolves.toEqual({ error: "unauthorized" })
  })

  it.each([
    ["FetchError 500", () => new FetchError("An unknown error occurred.", "Internal Server Error", 500)],
    ["network", () => new TypeError("fetch failed")],
  ])("SDK throw %s → { error: \"failed\" } ไม่ throw", async (_label, makeError) => {
    deleteLineItemSdk.mockRejectedValue(makeError())
    await expect(run()).resolves.toEqual({ error: "failed" })
  })

  it("ไม่มี cart id หรือ line id → { error: \"failed\" } ไม่ throw และไม่เรียก SDK", async () => {
    getCartId.mockResolvedValue(undefined)
    await expect(run()).resolves.toEqual({ error: "failed" })
    getCartId.mockResolvedValue("cart_1")
    await expect(run("")).resolves.toEqual({ error: "failed" })
    expect(deleteLineItemSdk).not.toHaveBeenCalled()
  })

  // qa #160 D-1: JWT หมดอายุ/ถูกลบ → middleware (clearStaleCartCookie) ล้าง `_medusa_cart_id` ใน request ของ action ด้วย
  // ต้องตอบ unauthorized ไม่ใช่ failed จากการไม่มี cart id
  it("ไม่มี JWT (และ cookie cart ถูกล้างแล้ว) → { error: \"unauthorized\" } ไม่เรียก SDK", async () => {
    getAuthHeaders.mockResolvedValue({})
    getCartId.mockResolvedValue(undefined)
    await expect(run()).resolves.toEqual({ error: "unauthorized" })
    expect(deleteLineItemSdk).not.toHaveBeenCalled()
  })
})
