import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CHECKOUT_CONFLICTS } from "@lib/util/checkout-error"

// CORE-4i-a (spec 01 กฎข้อ 72, AC-110): Next ใน production ซ่อน error ที่ throw จาก server action
// → `applyPromotions` / `updateLineItem` คืนผลแบบมีโครงสร้างผ่าน helper กลางแทนการ throw
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
const NOT_COMBINABLE = CHECKOUT_CONFLICTS.find((c) => c.code === "PROMOTION_NOT_COMBINABLE")!

const failures: [string, () => unknown, string][] = [
  ["FetchError 401", () => new FetchError("Unauthorized", "Unauthorized", 401), "unauthorized"],
  ["FetchError 403", () => new FetchError("Forbidden", "Forbidden", 403), "unauthorized"],
  ["FetchError 500", () => new FetchError("An unknown error occurred.", "Internal Server Error", 500), "failed"],
  ["network", () => new TypeError("fetch failed"), "failed"],
]

beforeEach(() => {
  vi.clearAllMocks()
  getCartId.mockResolvedValue("cart_1")
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("applyPromotions คืนผลแบบมีโครงสร้าง (AC-110)", () => {
  it("สำเร็จ → { ok: true, codes } เป็น code ที่อยู่ใน cart จริง และ revalidate", async () => {
    update.mockResolvedValue({ cart: { id: "cart_1", promotions: [{ id: "p1", code: "OK10" }] } })
    await expect((await cart()).applyPromotions(["OK10", "EXPIRED"])).resolves.toEqual({
      ok: true,
      codes: ["OK10"],
    })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it.each(failures)("SDK throw %s → { error } ไม่ throw", async (_label, makeError, expected) => {
    update.mockRejectedValue(makeError())
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: expected })
  })

  it("409 PROMOTION_NOT_COMBINABLE → { error: \"PROMOTION_NOT_COMBINABLE\" }", async () => {
    update.mockRejectedValue(new FetchError(NOT_COMBINABLE.message, "Conflict", 409))
    await expect((await cart()).applyPromotions(["A", "B"])).resolves.toEqual({
      error: "PROMOTION_NOT_COMBINABLE",
    })
  })

  it("ไม่มี JWT (cookie cart ถูกล้างแล้ว) → unauthorized ไม่เรียก SDK", async () => {
    getAuthHeaders.mockResolvedValue({})
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: "unauthorized" })
    expect(update).not.toHaveBeenCalled()
  })

  it("ไม่มี cart id → failed ไม่ throw", async () => {
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).applyPromotions(["X"])).resolves.toEqual({ error: "failed" })
  })
})

describe("updateLineItem คืนผลแบบมีโครงสร้าง (AC-110)", () => {
  it("สำเร็จ → { ok: true } และ revalidate", async () => {
    updateLineItemSdk.mockResolvedValue({ cart: {} })
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({ ok: true })
    expect(updateLineItemSdk).toHaveBeenCalledWith("cart_1", "line_1", { quantity: 2 }, {}, { authorization: "Bearer t" })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it.each(failures)("SDK throw %s → { error } ไม่ throw", async (_label, makeError, expected) => {
    updateLineItemSdk.mockRejectedValue(makeError())
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
    expect(updateLineItemSdk).not.toHaveBeenCalled()
  })

  it("ไม่มี cart id หรือ line id → failed ไม่ throw", async () => {
    await expect((await cart()).updateLineItem({ lineId: "", quantity: 2 })).resolves.toEqual({ error: "failed" })
    getCartId.mockResolvedValue(undefined)
    await expect((await cart()).updateLineItem({ lineId: "line_1", quantity: 2 })).resolves.toEqual({
      error: "failed",
    })
    expect(updateLineItemSdk).not.toHaveBeenCalled()
  })
})

describe("submitPromotionForm อ่านผลของ applyPromotions (AC-110)", () => {
  it("SDK 401 → SIGN_IN_AGAIN_MESSAGE", async () => {
    update.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", 401))
    const { SIGN_IN_AGAIN_MESSAGE } = await import("@lib/util/error-message")
    const form = new FormData()
    form.set("code", "X")
    await expect((await cart()).submitPromotionForm(null, form)).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })
})
