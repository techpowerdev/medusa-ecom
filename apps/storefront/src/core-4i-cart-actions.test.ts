import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4i-a (spec 01 กฎข้อ 72, AC-110): Next ใน production ซ่อน error ที่ throw จาก server action
// → `applyPromotions` / `updateLineItem` คืนผลแบบมีโครงสร้างผ่าน helper กลางแทนการ throw
// CORE-82 (กฎข้อ 140, ADR-028): ทั้งสอง action เรียก Store API ผ่าน medusaFetch (fetch ตรง) — ตัดสินจาก code ใน body
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
const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

const failures: [string, () => unknown, string][] = [
  ["401", () => respond(401, { type: "unauthorized", message: "Unauthorized" }), "unauthorized"],
  ["403", () => respond(403, { type: "not_allowed", message: "Forbidden" }), "unauthorized"],
  ["500", () => respond(500, { type: "unknown_error", message: "An unknown error occurred." }), "failed"],
  ["network", () => fetchMock.mockRejectedValue(new TypeError("fetch failed")), "failed"],
]

/** [path, body] ของ request ที่ medusaFetch ยิง */
const requests = () => fetchMock.mock.calls.map(([url, init]) => [String(url), JSON.parse(init.body)])

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  getCartId.mockResolvedValue("cart_1")
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => vi.unstubAllGlobals())

describe("applyPromotions คืนผลแบบมีโครงสร้าง (AC-110)", () => {
  it("สำเร็จ → { ok: true, codes } เป็น code ที่อยู่ใน cart จริง และ revalidate", async () => {
    respond(200, { cart: { id: "cart_1", promotions: [{ id: "p1", code: "OK10" }] } })
    await expect((await cart()).applyPromotions(["OK10", "EXPIRED"])).resolves.toEqual({
      ok: true,
      codes: ["OK10"],
    })
    expect(requests()).toEqual([["http://backend/store/carts/cart_1", { promo_codes: ["OK10", "EXPIRED"] }]])
    expect(revalidateTag).toHaveBeenCalled()
  })

  it.each(failures)("Store API %s → { error } ไม่ throw", async (_label, arrange, expected) => {
    arrange()
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: expected })
  })

  it("409 code PROMOTION_NOT_COMBINABLE → { error: \"PROMOTION_NOT_COMBINABLE\" }", async () => {
    respond(409, { type: "conflict", code: "PROMOTION_NOT_COMBINABLE", message: "x" })
    await expect((await cart()).applyPromotions(["A", "B"])).resolves.toEqual({
      error: "PROMOTION_NOT_COMBINABLE",
    })
  })

  it("409 ข้อความของ backend แต่ไม่มี code → failed (ไม่เทียบข้อความแล้ว — CORE-82)", async () => {
    respond(409, {
      type: "conflict",
      message: "This promotion can't be combined with the promotions already on the cart",
    })
    await expect((await cart()).applyPromotions(["A", "B"])).resolves.toEqual({ error: "failed" })
  })

  it("ไม่มี JWT (cookie cart ถูกล้างแล้ว) → unauthorized ไม่เรียก SDK", async () => {
    getAuthHeaders.mockResolvedValue({})
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: "unauthorized" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ไม่มี cart id → failed ไม่ throw", async () => {
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: "failed" })
  })
})

describe("updateLineItem คืนผลแบบมีโครงสร้าง (AC-110)", () => {
  it("สำเร็จ → { ok: true } และ revalidate", async () => {
    respond(200, { cart: {} })
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({ ok: true })
    expect(requests()).toEqual([["http://backend/store/carts/cart_1/line-items/line_1", { quantity: 2 }]])
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer t")
    expect(revalidateTag).toHaveBeenCalled()
  })

  it.each(failures)("Store API %s → { error } ไม่ throw", async (_label, arrange, expected) => {
    arrange()
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({
      error: expected,
    })
  })

  it("ไม่มี JWT → unauthorized ไม่เรียก SDK", async () => {
    getAuthHeaders.mockResolvedValue({})
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({
      error: "unauthorized",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ไม่มี cart id หรือ line id → failed ไม่ throw", async () => {
    await expect((await cart()).updateLineItem({ lineId: "", quantity: 2 })).resolves.toEqual({ error: "failed" })
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({
      error: "failed",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("submitPromotionForm อ่านผลของ applyPromotions (AC-110)", () => {
  it("Store API 401 → SIGN_IN_AGAIN_MESSAGE", async () => {
    respond(401, { type: "unauthorized", message: "Unauthorized" })
    const { SIGN_IN_AGAIN_MESSAGE } = await import("@lib/util/error-message")
    const form = new FormData()
    form.set("code", "X")
    await expect((await cart()).submitPromotionForm(null, form)).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })
})
