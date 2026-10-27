import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-14b (กฎ 26, AC-44/45): ล็อกอินพร้อม add_variant ที่ค้างไว้ → คง quantity; เพิ่มไม่สำเร็จต้องไม่เงียบ
const addToCart = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`)
})

vi.mock("@lib/config", () => ({
  sdk: {
    auth: { login: vi.fn().mockResolvedValue("tok") },
    store: { customer: { retrieve: vi.fn().mockResolvedValue({ customer: {} }) } },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("t"),
  getCartId: vi.fn().mockResolvedValue(undefined),
  setAuthToken: vi.fn(),
}))
vi.mock("@lib/data/cart", () => ({ addToCart: (...a: unknown[]) => addToCart(...a) }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
// unstable_rethrow ของจริงดู digest ของ error ที่ Next สร้าง — mock ให้ re-throw error ของ redirect mock ด้านบน
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("REDIRECT ")) {
      throw error
    }
  },
}))

const loginWith = async (entries: Record<string, string>) => {
  const { login } = await import("@lib/data/customer")
  const form = new FormData()
  form.set("email", "a@example.com")
  form.set("password", "pw")
  Object.entries(entries).forEach(([k, v]) => form.set(k, v))
  return login(null, form)
}

describe("login พร้อม add_variant ที่ค้างไว้ (CORE-14b)", () => {
  beforeEach(() => {
    addToCart.mockReset()
    redirect.mockClear()
  })

  it("เพิ่ม variant ด้วย quantity ที่เลือกไว้แล้วไปหน้า cart", async () => {
    await expect(
      loginWith({ add_variant: "variant_01", add_quantity: "3", country_code: "th" })
    ).rejects.toThrow("REDIRECT /th/cart")
    expect(addToCart).toHaveBeenCalledWith({ variantId: "variant_01", countryCode: "th", quantity: 3 })
  })

  it("เพิ่มไม่สำเร็จ → ไปหน้าบัญชีพร้อม add_variant + add_error เพื่อแสดง add-variant-error (CORE-14d)", async () => {
    addToCart.mockRejectedValueOnce(new Error("Variant does not exist"))
    await expect(
      loginWith({ add_variant: "variant_x", add_quantity: "2", country_code: "th" })
    ).rejects.toThrow("REDIRECT /th/account?add_variant=variant_x&add_quantity=2&add_error=1")
  })

  it("redirect/notFound ที่ addToCart throw ถูกส่งต่อด้วย unstable_rethrow ไม่กลายเป็น add_error (CORE-14d)", async () => {
    addToCart.mockRejectedValueOnce(new Error("REDIRECT /th/account?add_variant=variant_01"))
    await expect(
      loginWith({ add_variant: "variant_01", country_code: "th" })
    ).rejects.toThrow(/^REDIRECT \/th\/account\?add_variant=variant_01$/)
    expect(redirect).not.toHaveBeenCalled()
  })

  // CORE-14d (กฎ 58, owner 2026-10-27): ล็อกอินอยู่แล้ว → ปุ่มยืนยัน (ฟอร์ม POST) เรียก confirmPendingAdd
  const confirmWith = async (entries: Record<string, string>) => {
    const { confirmPendingAdd } = await import("@lib/data/customer")
    const form = new FormData()
    Object.entries(entries).forEach(([k, v]) => form.set(k, v))
    return confirmPendingAdd(form)
  }

  it("confirmPendingAdd เพิ่ม variant (clamp quantity 1..100) แล้วไปหน้า cart", async () => {
    await expect(
      confirmWith({ add_variant: "variant_01", add_quantity: "1000", country_code: "th" })
    ).rejects.toThrow("REDIRECT /th/cart")
    expect(addToCart).toHaveBeenCalledWith({ variantId: "variant_01", countryCode: "th", quantity: 100 })
  })

  it("confirmPendingAdd ปฏิเสธ countryCode ที่ไม่ใช่รหัสประเทศ (server action — กัน open redirect)", async () => {
    await expect(
      confirmWith({ add_variant: "v", country_code: "/evil.example" })
    ).rejects.toThrow(/[฀-๿]/)
    expect(addToCart).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
})
