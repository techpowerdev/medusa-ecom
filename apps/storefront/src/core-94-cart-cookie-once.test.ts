import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-94 (spec 01 กฎข้อ 150b, AC-191; review #514): `updateLineItem`/`applyPromotions` อ่าน cookie `_medusa_jwt`
// (`getAuthHeaders`) ครั้งเดียวต่อ action — header ที่ใช้เช็ก login ต้องเป็นชุดเดียวกับที่ส่งให้ medusaFetch
const fetchMock = vi.fn()
const getAuthHeaders = vi.fn()

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
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn() }))
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const cart = () => import("@lib/data/cart")

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer t" })
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ cart: { id: "cart_1", promotions: [] } }), { status: 200 })
  )
})

afterEach(() => vi.unstubAllGlobals())

describe("อ่าน cookie ของ auth ครั้งเดียวต่อ action (CORE-94, AC-191)", () => {
  it.each([
    ["updateLineItem", () => cart().then((c) => c.updateLineItem({ lineId: "li_1", quantity: 2 }))],
    ["applyPromotions", () => cart().then((c) => c.applyPromotions(["OK10"]))],
  ] as const)("%s → getAuthHeaders 1 ครั้ง และ request ส่ง authorization ชุดเดียวกัน", async (_name, run) => {
    await expect(run()).resolves.toMatchObject({ ok: true })
    expect(getAuthHeaders).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer t")
  })
})
