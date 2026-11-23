import { FetchError } from "@medusajs/js-sdk"
import { MedusaApiError } from "@lib/util/medusa-api-error"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-73 (spec 01 กฎข้อ 131, AC-172): สมัครด้วยอีเมลที่มีบัญชีลูกค้าแล้ว → ไม่ login ให้ (ไม่ตั้ง cookie/session,
// ไม่สร้าง customer) แสดง "อีเมลนี้มีบัญชีแล้ว" + ลิงก์เข้าสู่ระบบ; รหัสผิดได้ข้อความเดียวกัน;
// identity ที่ยังไม่มี customer (เช่นอีเมลเดียวกับบัญชี affiliate) → ผูก customer ใหม่ตามเดิม
const authLogin = vi.fn()
const authRegister = vi.fn()
const customerRetrieve = vi.fn()
const customerCreate = vi.fn()
const setAuthToken = vi.fn()
const removePendingCustomer = vi.fn()
const clientFetch = vi.fn()
const cookieSet = vi.fn()
const actionState = vi.hoisted(() => ({ current: null as unknown }))

vi.mock("@lib/config", () => ({
  sdk: {
    auth: {
      login: (...a: unknown[]) => authLogin(...a),
      register: (...a: unknown[]) => authRegister(...a),
    },
    client: { fetch: (...a: unknown[]) => clientFetch(...a) },
    store: {
      customer: {
        retrieve: (...a: unknown[]) => customerRetrieve(...a),
        create: (...a: unknown[]) => customerCreate(...a),
      },
    },
  },
}))
// CORE-83 (กฎข้อ 140, ADR-028): register ผ่าน `medusaFetch` (ได้ type ของ error) — ส่งต่อให้ authRegister แบบ sdk.auth.register
// CORE-84: register ของ affiliate ผ่าน medusaFetch ด้วย — ส่งต่อให้ clientFetch แบบ sdk.client.fetch เดิม
vi.mock("@lib/data/medusa-fetch", () => ({
  medusaFetch: async (path: string, body: unknown) => {
    if (path.startsWith("/auth/affiliate/") || path === "/affiliate/register") {
      return clientFetch(path, { method: "POST", body })
    }
    if (path !== "/auth/customer/emailpass/register") throw new Error(`unexpected ${path}`)
    return { token: await authRegister("customer", "emailpass", body) }
  },
}))
vi.mock("@lib/data/cookies", () => ({
  setPendingCustomer: vi.fn(),
  getPendingCustomer: vi.fn(async () => ({ first_name: "สมชาย", last_name: "ใจดี", phone: "" })),
  removePendingCustomer: (...a: unknown[]) => removePendingCustomer(...a),
  setAuthToken: (...a: unknown[]) => setAuthToken(...a),
  getCacheTag: vi.fn(async () => "customers"),
  getCartId: vi.fn(async () => undefined),
}))
vi.mock("@lib/data/cart", () => ({ addToCart: vi.fn() }))
vi.mock("@lib/data/active-cart", () => ({ restoreActiveCart: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: vi.fn(), delete: vi.fn() }) }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
  useParams: () => ({ countryCode: "th" }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return { ...actual, useActionState: () => [actionState.current, vi.fn(), false] }
})

const EMAIL = "taken@example.com"
const EXISTS_MESSAGE = "อีเมลนี้มีบัญชีแล้ว"

const form = (password = "correct-password") => {
  const f = new FormData()
  f.set("email", EMAIL)
  f.set("password", password)
  f.set("first_name", "สมชาย")
  f.set("last_name", "ใจดี")
  f.set("phone", "0812345678")
  return f
}

const identityExists = () =>
  authRegister.mockRejectedValue(
    new MedusaApiError({ status: 401, type: "unauthorized", message: "Identity with email already exists" })
  )

describe("CORE-73: signup ด้วยอีเมลที่มีบัญชีแล้ว (กฎข้อ 131)", () => {
  beforeEach(() => {
    for (const m of [authLogin, authRegister, customerRetrieve, customerCreate, setAuthToken, removePendingCustomer]) {
      m.mockReset()
    }
  })

  it("มี customer อยู่แล้ว + รหัสถูก → ไม่ตั้ง cookie ไม่สร้าง customer และคืน email_exists พร้อมค่าที่กรอก", async () => {
    identityExists()
    authLogin.mockResolvedValue("customer-token")
    customerRetrieve.mockResolvedValue({ customer: { id: "cus_1", email: EMAIL } })
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, form())
    expect(result).toMatchObject({
      state: "error",
      reason: "email_exists",
      error: EXISTS_MESSAGE,
      email: EMAIL,
      fields: { first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678" },
    })
    expect(setAuthToken).not.toHaveBeenCalled()
    expect(customerCreate).not.toHaveBeenCalled()
    expect(removePendingCustomer).toHaveBeenCalled()
  })

  it("มีบัญชีแล้ว + รหัสผิด → ข้อความเดียวกัน (ไม่บอกว่ารหัสถูก/ผิด)", async () => {
    identityExists()
    authLogin.mockRejectedValue(new FetchError("Invalid email or password", "Unauthorized", 401))
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, form("wrong"))
    expect(result).toMatchObject({ state: "error", reason: "email_exists", error: EXISTS_MESSAGE })
    expect(setAuthToken).not.toHaveBeenCalled()
    expect(customerCreate).not.toHaveBeenCalled()
  })

  it("identity มีอยู่แต่ยังไม่มี customer (affiliate) → สร้าง customer และเข้าสู่ระบบตามเดิม (regression)", async () => {
    identityExists()
    authLogin.mockResolvedValueOnce("identity-only-token").mockResolvedValueOnce("customer-token")
    customerRetrieve.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", 401))
    customerCreate.mockResolvedValue({ customer: { id: "cus_new" } })
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, form())
    expect(result).toEqual({ state: "success" })
    expect(customerCreate).toHaveBeenCalledTimes(1)
    expect(setAuthToken).toHaveBeenCalledWith("customer-token")
  })

  it("อีเมลใหม่ → สมัครและเข้าสู่ระบบตามเดิม", async () => {
    authRegister.mockResolvedValue("register-token")
    authLogin.mockResolvedValueOnce("identity-only-token").mockResolvedValueOnce("customer-token")
    customerRetrieve.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", 401))
    customerCreate.mockResolvedValue({ customer: { id: "cus_new" } })
    const { signup } = await import("@lib/data/customer")
    expect(await signup(null, form())).toEqual({ state: "success" })
    expect(setAuthToken).toHaveBeenCalledWith("customer-token")
  })

  it("login (ไม่ใช่ signup) ของลูกค้าที่มีอยู่ยังเข้าสู่ระบบได้", async () => {
    authLogin.mockResolvedValue("customer-token")
    customerRetrieve.mockResolvedValue({ customer: { id: "cus_1", email: EMAIL, metadata: {} } })
    const { login } = await import("@lib/data/customer")
    expect(await login(null, form())).toEqual({ state: "success" })
    expect(setAuthToken).toHaveBeenCalledWith("customer-token")
  })
})

describe("CORE-73: component register แสดง register-email-exists + register-login-link", () => {
  const render = async (state: unknown) => {
    actionState.current = state
    const { default: Register } = await import("@modules/account/components/register")
    return renderToStaticMarkup(createElement(Register, { setCurrentView: vi.fn() }))
  }

  it("reason email_exists → ข้อความ + ลิงก์เข้าสู่ระบบ และคงอีเมลที่กรอก", async () => {
    const html = await render({
      state: "error",
      reason: "email_exists",
      error: EXISTS_MESSAGE,
      email: EMAIL,
      fields: { first_name: "สมชาย", last_name: "ใจดี", phone: "" },
    })
    const box = html.match(/<[^>]*data-testid="register-email-exists"[\s\S]*?<\/div>/)?.[0] ?? ""
    expect(box).toContain(EXISTS_MESSAGE)
    expect(box).toContain('data-testid="register-login-link"')
    expect(html).not.toContain('data-testid="register-error"')
    expect(html.match(/<input[^>]*data-testid="email-input"[^>]*>/)?.[0]).toContain(`value="${EMAIL}"`)
  })

  it("error อื่น → register-error เดิม ไม่มี register-email-exists", async () => {
    const html = await render({ state: "error", error: "สมัครสมาชิกไม่สำเร็จ", email: EMAIL })
    expect(html).toContain('data-testid="register-error"')
    expect(html).not.toContain("register-email-exists")
  })
})

// F-1 จาก qa #458 (session หลักตัดสิน 2026-11-21): emailpass ของ Medusa แยกตัวพิมพ์ → storefront normalize อีเมล
// เป็น trim().toLowerCase() ทุกทางเข้า (สมัคร/login ของลูกค้า และ portal affiliate ที่ใช้ identity emailpass ชุดเดียวกัน)
describe("CORE-73 F-1: normalize อีเมลก่อนส่ง auth ของ Medusa", () => {
  const MIXED = "  Taken@EXAMPLE.com "
  const LOWER = "taken@example.com"
  const mixedForm = () => {
    const f = form()
    f.set("email", MIXED)
    f.set("countryCode", "th")
    f.set("name", "ทดสอบ")
    f.set("code", "e2e-code")
    return f
  }

  beforeEach(() => {
    for (const m of [authLogin, authRegister, customerRetrieve, customerCreate, setAuthToken, clientFetch, cookieSet]) {
      m.mockReset()
    }
  })

  it("signup ด้วยตัวพิมพ์ใหญ่ของอีเมลลูกค้าเดิม → register/login ด้วยอีเมลตัวเล็ก และได้ email_exists", async () => {
    identityExists()
    authLogin.mockResolvedValue("customer-token")
    customerRetrieve.mockResolvedValue({ customer: { id: "cus_1", email: LOWER } })
    const { signup } = await import("@lib/data/customer")
    const result = await signup(null, mixedForm())
    expect(authRegister.mock.calls[0][2]).toMatchObject({ email: LOWER })
    expect(authLogin.mock.calls[0][2]).toMatchObject({ email: LOWER })
    expect(result).toMatchObject({ state: "error", reason: "email_exists", email: LOWER })
    expect(setAuthToken).not.toHaveBeenCalled()
  })

  it("signup อีเมลใหม่ตัวพิมพ์ปน → สร้าง customer ด้วยอีเมลตัวเล็ก", async () => {
    authRegister.mockResolvedValue("register-token")
    authLogin.mockResolvedValueOnce("identity-only-token").mockResolvedValueOnce("customer-token")
    customerRetrieve.mockRejectedValue(new FetchError("Unauthorized", "Unauthorized", 401))
    customerCreate.mockResolvedValue({ customer: { id: "cus_new" } })
    const { signup } = await import("@lib/data/customer")
    expect(await signup(null, mixedForm())).toEqual({ state: "success" })
    expect(customerCreate.mock.calls[0][0]).toMatchObject({ email: LOWER })
    for (const call of authLogin.mock.calls) expect(call[2]).toMatchObject({ email: LOWER })
  })

  it("login ด้วยตัวพิมพ์ใหญ่ของบัญชีตัวเล็ก → login ด้วยอีเมลตัวเล็ก", async () => {
    authLogin.mockResolvedValue("customer-token")
    customerRetrieve.mockResolvedValue({ customer: { id: "cus_1", email: LOWER, metadata: {} } })
    const { login } = await import("@lib/data/customer")
    expect(await login(null, mixedForm())).toEqual({ state: "success" })
    expect(authLogin.mock.calls[0][2]).toMatchObject({ email: LOWER })
  })

  it("affiliate portal login/register ส่งอีเมลตัวเล็ก (identity emailpass ชุดเดียวกับลูกค้า)", async () => {
    clientFetch.mockResolvedValue({ token: "t", affiliate: { id: "aff_1" } })
    const { affiliateLogin, affiliateRegister } = await import("@lib/data/affiliate-portal")
    await affiliateLogin(null as never, mixedForm())
    await affiliateRegister(null as never, mixedForm())
    const authCalls = clientFetch.mock.calls.filter(([url]) => String(url).startsWith("/auth/affiliate/emailpass"))
    expect(authCalls.length).toBeGreaterThanOrEqual(3)
    for (const [, init] of authCalls) expect((init as { body: { email: string } }).body.email).toBe(LOWER)
  })
})
