import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

import compareAddresses from "@lib/util/compare-addresses"
import {
  GENERIC_ERROR_MESSAGE,
  SIGN_IN_AGAIN_MESSAGE,
  friendlyErrorMessage,
} from "@lib/util/error-message"
import medusaError from "@lib/util/medusa-error"

// CORE-4g (spec 01 กฎข้อ 63, AC-99): medusaError คง HTTP status, applyPromotions คืน code ที่ใช้ได้จริง,
// compareAddresses ถือ null/undefined/"" เท่ากัน
const update = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: { store: { cart: { update: (...a: unknown[]) => update(...a) } } },
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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

const caught = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error("ไม่ได้ throw")
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("medusaError คง status (AC-99)", () => {
  it.each([401, 403])("FetchError %i → friendlyErrorMessage ให้เข้าสู่ระบบใหม่", (status) => {
    const error = caught(() => medusaError(new FetchError("Unauthorized", "Unauthorized", status)))
    expect(error).toBeInstanceOf(Error)
    expect((error as { status?: number }).status).toBe(status)
    expect(friendlyErrorMessage(error)).toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("FetchError 500 → ข้อความ fallback (ต่างจาก 401)", () => {
    const error = caught(() => medusaError(new FetchError("boom", "Internal Server Error", 500)))
    expect((error as { status?: number }).status).toBe(500)
    expect(friendlyErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE)
    expect(friendlyErrorMessage(error)).not.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("setAddresses: SDK 401 → ข้อความให้เข้าสู่ระบบใหม่ (ผ่าน medusaError ของ updateCart)", async () => {
    update.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", 401))
    const { setAddresses } = await import("@lib/data/cart")
    const form = new FormData()
    form.set("shipping_address.country_code", "th")
    form.set("same_as_billing", "on")
    expect(await setAddresses(null, form)).toBe(SIGN_IN_AGAIN_MESSAGE)
  })
})

describe("applyPromotions คืน code ที่อยู่ใน cart จริง (กฎข้อ 63b)", () => {
  it("Medusa ตอบ 200 แต่ไม่มี code ที่ส่งไป → ไม่อยู่ในผลลัพธ์", async () => {
    update.mockResolvedValue({
      cart: { id: "cart_1", promotions: [{ id: "promo_1", code: "OK10" }] },
    })
    const { applyPromotions } = await import("@lib/data/cart")
    const applied = await applyPromotions(["OK10", "EXPIRED"])
    expect(applied).toEqual(["OK10"])
  })
})

describe("compareAddresses (AC-99)", () => {
  const base = {
    first_name: "สมชาย",
    last_name: "ใจดี",
    address_1: "99 ถนนสุขุมวิท",
    postal_code: "10110",
    city: "วัฒนา",
    country_code: "th",
    phone: "0812345678",
  }

  it.each([
    [null, ""],
    [undefined, ""],
    [null, undefined],
  ])("company %s เท่ากับ %s", (a, b) => {
    expect(compareAddresses({ ...base, company: a }, { ...base, company: b })).toBe(true)
  })

  it("ไม่มี key เลยเท่ากับค่าว่าง", () => {
    expect(compareAddresses(base, { ...base, company: "", province: null })).toBe(true)
  })

  it("ค่าต่างกันจริงยังไม่เท่ากัน", () => {
    expect(compareAddresses({ ...base, company: "A" }, { ...base, company: "" })).toBe(false)
  })
})
