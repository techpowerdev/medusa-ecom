import { beforeEach, describe, expect, it, vi } from "vitest"

import { MedusaApiError } from "@lib/util/medusa-api-error"

// FS-15 (spec 03 กฎข้อ 20c, AC-22): placeOrder เป็น server action — error ที่ throw ข้าม boundary ถูกซ่อนข้อความใน production build
// จึงคืน 409 ที่รู้จัก (FLASH_*, PROMOTION_NOT_COMBINABLE) เป็น `{ error: <code> }` ให้ปุ่มในขั้น review แปลงเป็นข้อความไทย;
// CORE-4i-b (spec 01 กฎข้อ 72): error อื่น → `{ error: "failed" }` แทนการ throw
// CORE-82 (spec 01 กฎข้อ 140, ADR-028): complete ผ่าน medusaFetch — ตัดสินจาก code ไม่ใช่ข้อความ
const complete = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: { client: { fetch: vi.fn() }, store: { cart: { complete: (...a: unknown[]) => complete(...a) } } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("carts-t"),
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/medusa-fetch", () => ({ medusaFetch: (...a: unknown[]) => complete(...a) }))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const apiError = (message: string, status = 409, code: string | null = null, type: string | null = null) =>
  new MedusaApiError({ status, type, code, message })

const place = async () => (await import("@lib/data/cart")).placeOrder("cart_1")

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("placeOrder: 409 ตอน complete (FS-15)", () => {
  // CORE-76 (spec 01 กฎข้อ 134 a2): ผลเป็น kind — ข้อความไทยของ code แปลงที่ UI (checkoutNotice)
  it("FLASH_SOLD_OUT → คืน { kind: refunded, code } ไม่ throw", async () => {
    complete.mockRejectedValueOnce(apiError("This flash sale is sold out", 409, "FLASH_SOLD_OUT", "conflict"))
    await expect(place()).resolves.toEqual({ kind: "refunded", code: "FLASH_SOLD_OUT" })
    expect(complete).toHaveBeenCalledWith("/store/carts/cart_1/complete")
  })

  it("ข้อความ FLASH_SOLD_OUT แต่ไม่มี code → { kind: \"failed\" } (ไม่เทียบข้อความแล้ว)", async () => {
    complete.mockRejectedValueOnce(apiError("This flash sale is sold out", 409, null, "conflict"))
    await expect(place()).resolves.toEqual({ kind: "failed" })
  })

  it("FS-22 (spec 03 กฎข้อ 27): 400 สต็อกไม่พอตอน reserveInventory → refunded OUT_OF_STOCK", async () => {
    complete.mockRejectedValueOnce(
      apiError("Not enough stock available for item iitem_1 at location sloc_1", 400, null, "not_allowed")
    )
    await expect(place()).resolves.toEqual({ kind: "refunded", code: "OUT_OF_STOCK" })
  })

  it("error อื่น → { kind: \"failed\" } ไม่ throw (ผู้เรียกใช้ข้อความ fallback ของตัวเอง)", async () => {
    complete.mockRejectedValueOnce(apiError("Payment sessions are required", 400, null, "invalid_data"))
    await expect(place()).resolves.toEqual({ kind: "failed" })
  })
})
