import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-14c (spec 01 กฎข้อ 40, AC-76): cookie `_medusa_cart_id` ชี้ cart ของ customer อื่น → transferCart ได้ 404 จาก ownership
// (CORE-12/ADR-013) → login ต้องสำเร็จและล้าง cookie cart; error อื่นของ transfer ยังส่งต่อ
const transferCart = vi.fn()
const removeCartId = vi.fn()

vi.mock("@lib/config", () => ({
  sdk: {
    auth: { login: vi.fn().mockResolvedValue("tok") },
    store: {
      customer: { retrieve: vi.fn().mockResolvedValue({ customer: {} }) },
      cart: { transferCart: (...a: unknown[]) => transferCart(...a) },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer tok" }),
  getCacheTag: vi.fn().mockResolvedValue("t"),
  getCartId: vi.fn().mockResolvedValue("cart_of_b"),
  removeCartId: () => removeCartId(),
  setAuthToken: vi.fn(),
}))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

const login = async () => {
  const { login } = await import("@lib/data/customer")
  const form = new FormData()
  form.set("email", "a@example.com")
  form.set("password", "pw")
  return login(null, form)
}

describe("login ขณะมี cookie cart ของคนอื่น (CORE-14c)", () => {
  beforeEach(() => {
    transferCart.mockReset()
    removeCartId.mockReset()
  })

  it("transfer ได้ 404 → login สำเร็จและล้าง cookie cart", async () => {
    transferCart.mockRejectedValueOnce(new FetchError("Cart not found", "Not Found", 404))
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(transferCart).toHaveBeenCalledWith("cart_of_b", {}, { authorization: "Bearer tok" })
    expect(removeCartId).toHaveBeenCalledTimes(1)
  })

  it("transfer ได้ 500 → error ถูกส่งต่อ และไม่ล้าง cookie cart", async () => {
    transferCart.mockRejectedValueOnce(new FetchError("boom", "Internal Server Error", 500))
    await expect(login()).resolves.toMatchObject({ state: "error" })
    expect(removeCartId).not.toHaveBeenCalled()
  })

  it("network error → error ถูกส่งต่อ", async () => {
    transferCart.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(login()).resolves.toMatchObject({ state: "error" })
    expect(removeCartId).not.toHaveBeenCalled()
  })

  it("transfer สำเร็จ → login สำเร็จและคง cookie cart", async () => {
    transferCart.mockResolvedValueOnce({ cart: {} })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(removeCartId).not.toHaveBeenCalled()
  })
})
