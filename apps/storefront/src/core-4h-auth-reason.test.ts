import { FetchError } from "@medusajs/js-sdk"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4h (spec 01 กฎข้อ 69, AC-105): action login คืน `reason` ให้ UI ตัดสินแทนการเทียบข้อความ,
// register 401 ที่ไม่ใช่อีเมลซ้ำได้ข้อความทั่วไปของการสมัคร, ฟอร์มสมัครที่ล้มคงชื่อ/นามสกุล/เบอร์,
// หน้า verify-account ได้ error ไทยผ่าน friendlyErrorMessage
const authLogin = vi.fn()
const authRegister = vi.fn()
const verificationConfirm = vi.fn()
const actionState = vi.hoisted(() => ({ current: null as unknown }))

vi.mock("@lib/config", () => ({
  sdk: {
    auth: {
      login: (...a: unknown[]) => authLogin(...a),
      register: (...a: unknown[]) => authRegister(...a),
      verification: { confirm: (...a: unknown[]) => verificationConfirm(...a) },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({ setPendingCustomer: vi.fn() }))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useParams: () => ({ countryCode: "th" }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return { ...actual, useActionState: () => [actionState.current, vi.fn(), false] }
})

const THAI = /[฀-๿]/
const EMAIL = "a@example.com"

const form = () => {
  const f = new FormData()
  f.set("email", EMAIL)
  f.set("password", "wrong")
  f.set("first_name", "สมชาย")
  f.set("last_name", "ใจดี")
  f.set("phone", "0812345678")
  return f
}

const unauthorized = (message: string) => new FetchError(message, "Unauthorized", 401)

describe("CORE-4h: reason ของ login และข้อความของ register (กฎข้อ 69a)", () => {
  beforeEach(() => {
    authLogin.mockReset()
    authRegister.mockReset()
    verificationConfirm.mockReset()
  })

  it("login ได้ 401 → คืน reason: invalid_credentials", async () => {
    authLogin.mockRejectedValue(unauthorized("Invalid email or password"))
    const { login } = await import("@lib/data/customer")
    expect(await login(null, form())).toMatchObject({
      state: "error",
      reason: "invalid_credentials",
    })
  })

  it("login ได้ 500 → ไม่มี reason invalid_credentials", async () => {
    authLogin.mockRejectedValue(new FetchError("boom", "Internal Server Error", 500))
    const { login } = await import("@lib/data/customer")
    const result = await login(null, form())
    expect(result).toMatchObject({ state: "error" })
    expect((result as { reason?: string }).reason).toBeUndefined()
  })

  it("register 401 ที่ไม่ใช่อีเมลซ้ำ → ข้อความทั่วไปของการสมัคร ไม่บอกว่ามีบัญชีอยู่แล้ว", async () => {
    authRegister.mockRejectedValue(unauthorized("Unauthorized"))
    const { signup } = await import("@lib/data/customer")
    const error = ((await signup(null, form())) as { error: string }).error
    expect(error).toMatch(THAI)
    expect(error).not.toContain("มีบัญชีอยู่แล้ว")
    expect(error).toContain("สมัครสมาชิกไม่สำเร็จ")
    expect(authLogin).not.toHaveBeenCalled()
  })

  it("register ล้ม → คืนชื่อ/นามสกุล/เบอร์/อีเมลที่กรอกไว้ (กฎข้อ 69b)", async () => {
    authRegister.mockRejectedValue(
      new FetchError("Identity with email already exists", "Unauthorized", 401)
    )
    authLogin.mockRejectedValue(unauthorized("Invalid email or password"))
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, form())
    expect(result).toMatchObject({
      state: "error",
      email: EMAIL,
      fields: { first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678" },
    })
    expect((result as { error: string }).error).toContain("มีบัญชีอยู่แล้ว")
  })

  it("verify-account: token ไม่ถูกต้อง → error ไทย ไม่ใช่ข้อความดิบ (กฎข้อ 69d)", async () => {
    verificationConfirm.mockRejectedValue(new FetchError("Invalid token", "Bad Request", 400))
    const { confirmEmailVerification } = await import("@lib/data/customer")
    const result = await confirmEmailVerification("bad")
    expect(result.success).toBe(false)
    expect(result.error).toMatch(THAI)
    expect(result.error).not.toMatch(/[A-Za-z]{4,}/)
  })
})

describe("CORE-4h: component login/register ตัดสินจาก state (กฎข้อ 69a/b)", () => {
  it("login: reason invalid_credentials → ข้อความไทยของรหัสผ่านผิด ไม่ใช่ข้อความที่ action ส่งมา", async () => {
    actionState.current = {
      state: "error",
      reason: "invalid_credentials",
      error: "provider says nope",
      email: EMAIL,
    }
    const { default: Login } = await import("@modules/account/components/login")
    const html = renderToStaticMarkup(createElement(Login, { setCurrentView: vi.fn() }))
    expect(html).toContain("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    expect(html).not.toContain("provider says nope")
  })

  it("register: ล้มแล้ว input ชื่อ/นามสกุล/เบอร์/อีเมลมีค่าเดิม", async () => {
    actionState.current = {
      state: "error",
      error: "สมัครสมาชิกไม่สำเร็จ",
      email: EMAIL,
      fields: { first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678" },
    }
    const { default: Register } = await import("@modules/account/components/register")
    const html = renderToStaticMarkup(createElement(Register, { setCurrentView: vi.fn() }))
    for (const [testId, value] of [
      ["first-name-input", "สมชาย"],
      ["last-name-input", "ใจดี"],
      ["phone-input", "0812345678"],
      ["email-input", EMAIL],
    ]) {
      const input = html.match(new RegExp(`<input[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ""
      expect(input, testId).toContain(`value="${value}"`)
    }
  })
})
