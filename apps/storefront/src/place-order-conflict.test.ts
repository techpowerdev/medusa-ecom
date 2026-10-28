import { beforeEach, describe, expect, it, vi } from "vitest"

// FS-15 (spec 03 กฎข้อ 20c, AC-22): placeOrder เป็น server action — error ที่ throw ข้าม boundary ถูกซ่อนข้อความใน production build
// จึงคืน 409 ที่รู้จัก (FLASH_*, PROMOTION_NOT_COMBINABLE) เป็นค่า `{ error }` ภาษาไทยให้ปุ่มในขั้น review แสดง; error อื่น throw เหมือนเดิม
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
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const fetchError = (message: string, status = 409) =>
  Object.assign(new Error(message), { status, statusText: "Conflict" })

const place = async () => (await import("@lib/data/cart")).placeOrder("cart_1")

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("placeOrder: 409 ตอน complete (FS-15)", () => {
  it("FLASH_SOLD_OUT → คืน { error } เป็นข้อความไทย ไม่ throw", async () => {
    complete.mockRejectedValueOnce(fetchError("This flash sale is sold out"))
    const res = await place()
    expect(res).toEqual({ error: expect.stringMatching(/[฀-๿]/) })
    expect((res as { error: string }).error).not.toContain("sold out")
  })

  it("error อื่น → throw เหมือนเดิม (ผู้เรียกใช้ข้อความ fallback ของตัวเอง)", async () => {
    complete.mockRejectedValueOnce(
      Object.assign(fetchError("Payment sessions are required", 400), {
        response: undefined,
      })
    )
    await expect(place()).rejects.toThrow()
  })
})
