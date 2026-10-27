import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4f (spec 01 กฎข้อ 62, AC-98): error ของ action login/register เป็นไทยทุกกรณี (401/500/network)
// และคืนอีเมลที่กรอกไว้ให้ฟอร์มใช้เป็น defaultValue (ไม่ถูก reset โดย React 19 form action)
const authLogin = vi.fn()
const authRegister = vi.fn()

vi.mock("@lib/config", () => ({
  sdk: {
    auth: {
      login: (...a: unknown[]) => authLogin(...a),
      register: (...a: unknown[]) => authRegister(...a),
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({ setPendingCustomer: vi.fn() }))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

const THAI = /[฀-๿]/
const EMAIL = "a@example.com"

const form = () => {
  const f = new FormData()
  f.set("email", EMAIL)
  f.set("password", "wrong")
  f.set("first_name", "ก")
  f.set("last_name", "ข")
  return f
}

const failures: [string, () => unknown][] = [
  ["401", () => new FetchError("Invalid email or password", "Unauthorized", 401)],
  ["500", () => new FetchError("An unknown error occurred.", "Internal Server Error", 500)],
  ["network", () => new TypeError("fetch failed")],
]

const expectThaiError = (result: unknown) => {
  expect(result).toMatchObject({ state: "error", email: EMAIL })
  const error = (result as { error: string }).error
  expect(error).toMatch(THAI)
  expect(error).not.toMatch(/Invalid|email|password|unknown|fetch/i)
}

describe("action login/register คืน error ไทยและคงอีเมล (CORE-4f)", () => {
  beforeEach(() => {
    authLogin.mockReset()
    authRegister.mockReset()
  })

  it.each(failures)("login: SDK throw %s → ข้อความไทย + อีเมลเดิม", async (_, make) => {
    authLogin.mockRejectedValue(make())
    const { login } = await import("@lib/data/customer")
    expectThaiError(await login(null, form()))
  })

  it.each(failures)("register: SDK throw %s → ข้อความไทย + อีเมลเดิม", async (_, make) => {
    authRegister.mockRejectedValue(make())
    const { signup } = await import("@lib/data/customer")
    expectThaiError(await signup(null, form()))
  })

  it("register ด้วยอีเมลที่มีบัญชีแล้ว (รหัสผ่านไม่ตรง) → บอกเป็นไทยว่าอีเมลนี้มีบัญชีแล้ว", async () => {
    authRegister.mockRejectedValue(
      new FetchError("Identity with email already exists", "Unauthorized", 401)
    )
    authLogin.mockRejectedValue(new FetchError("Invalid email or password", "Unauthorized", 401))
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, form())
    expectThaiError(result)
    expect((result as { error: string }).error).toContain("มีบัญชี")
  })
})
