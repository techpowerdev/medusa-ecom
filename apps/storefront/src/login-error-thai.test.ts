import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4e (follow-up qa #109): login ไม่สำเร็จ → `login-error-message` เป็นไทย ไม่ใช่ "Invalid email or password" ดิบของ Medusa
const authLogin = vi.fn()

vi.mock("@lib/config", () => ({
  sdk: { auth: { login: (...a: unknown[]) => authLogin(...a) } },
}))
vi.mock("@lib/data/cookies", () => ({}))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

const THAI = /[฀-๿]/

const login = async () => {
  const { login } = await import("@lib/data/customer")
  const form = new FormData()
  form.set("email", "a@example.com")
  form.set("password", "wrong")
  return login(null, form)
}

describe("ข้อความ error ของ login เป็นไทย (CORE-4e)", () => {
  beforeEach(() => {
    authLogin.mockReset()
  })

  it("401 Invalid email or password → บอกว่าอีเมลหรือรหัสผ่านไม่ถูกต้องเป็นไทย", async () => {
    authLogin.mockRejectedValue(new FetchError("Invalid email or password", "Unauthorized", 401))
    const result = await login()
    expect(result).toMatchObject({ state: "error" })
    const error = (result as { error: string }).error
    expect(error).toMatch(THAI)
    expect(error).not.toMatch(/Invalid|email|password/i)
  })

  it("network error → ข้อความไทยทั่วไป", async () => {
    authLogin.mockRejectedValue(new TypeError("fetch failed"))
    const result = await login()
    const error = (result as { error: string }).error
    expect(error).toMatch(THAI)
    expect(error).not.toContain("fetch failed")
  })
})
