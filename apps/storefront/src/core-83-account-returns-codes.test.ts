import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isUncodedMedusaError, MedusaApiError } from "@lib/util/medusa-api-error"

// CORE-83 (spec 01 กฎข้อ 140, AC-181 b, ADR-028): กลุ่ม account/returns/auth ตัดสิน error ด้วย code/type
// — register และ POST /store/returns ผ่าน `medusaFetch`; ข้อความของ Medusa core ที่ไม่มี code อยู่ในข้อยกเว้นของ helper
vi.mock("server-only", () => ({}))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: async () => ({}) }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: async () => null }))

const src = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8")

describe("ข้อยกเว้น IDENTITY_EXISTS ของ helper (Medusa core ไม่มี code)", () => {
  const identityExists = (overrides: object = {}) =>
    new MedusaApiError({
      status: 401,
      type: "unauthorized",
      message: "Identity with email already exists",
      ...overrides,
    })

  it("401 unauthorized + ข้อความของ auth-emailpass → true", () => {
    expect(isUncodedMedusaError(identityExists(), "IDENTITY_EXISTS")).toBe(true)
  })

  it("status/type/ข้อความต่าง หรือ FetchError ที่ไม่มี type → false", () => {
    expect(isUncodedMedusaError(identityExists({ status: 400 }), "IDENTITY_EXISTS")).toBe(false)
    expect(isUncodedMedusaError(identityExists({ type: "invalid_data" }), "IDENTITY_EXISTS")).toBe(false)
    expect(isUncodedMedusaError(identityExists({ message: "Invalid email or password" }), "IDENTITY_EXISTS")).toBe(false)
    expect(
      isUncodedMedusaError(
        Object.assign(new Error("Identity with email already exists"), { status: 401 }),
        "IDENTITY_EXISTS"
      )
    ).toBe(false)
  })
})

// nit review #514: base URL ที่มี `/` ท้าย → ต่อ path แบบเดียวกับ js-sdk (ไม่เป็น `//store/...`)
describe("medusaFetch: base URL ที่มี / ท้าย", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset().mockImplementation(async () => new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it.each([
    ["http://backend.test/", "http://backend.test/store/returns"],
    ["http://backend.test", "http://backend.test/store/returns"],
    ["http://backend.test/medusa/", "http://backend.test/medusa/store/returns"],
  ])("%s → URL เดียวกับ sdk.client.fetch", async (base, expected) => {
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL", base)
    vi.resetModules()
    const { medusaFetch } = await import("@lib/data/medusa-fetch")
    await medusaFetch("/store/returns", {})
    const { sdk } = await import("@lib/config")
    await sdk.client.fetch("/store/returns", { method: "POST", body: {} })
    const [ours, theirs] = fetchMock.mock.calls.map(([input]) => String(input))
    expect(ours).toBe(expected)
    expect(ours).toBe(theirs)
  })
})

describe("static: กลุ่ม account/returns/auth ตัดสินจาก code (AC-181 b)", () => {
  const GROUP = ["lib/data/customer.ts", "lib/data/returns.ts", "lib/util/return-request.ts"]
  const ENGLISH_MESSAGES = [
    "Identity with email already exists",
    "Only shipped products of the order can be returned",
    "Items that have not been shipped cannot be returned",
    "The return window for this order has expired",
    "This item cannot be returned online",
    "Return shipping option has no stock location",
  ]

  it.each(GROUP)("%s ไม่มีข้อความอังกฤษของ backend และไม่เทียบ message/statusText", (file) => {
    const text = src(file)
    for (const message of ENGLISH_MESSAGES) {
      expect(text, message).not.toContain(message)
    }
    expect(text).not.toMatch(/message\s*[!=]==|statusText/)
  })

  it("ข้อยกเว้น Identity with email already exists อยู่ใน helper", () => {
    expect(src("lib/util/medusa-api-error.ts")).toContain('"Identity with email already exists"')
  })

  it("register และ POST /store/returns ใช้ medusaFetch ไม่ใช่ SDK", () => {
    expect(src("lib/data/customer.ts")).not.toMatch(/sdk\.auth\.register/)
    expect(src("lib/data/customer.ts")).toContain('medusaFetch<{ token: string }>("/auth/customer/emailpass/register"')
    expect(src("lib/data/returns.ts")).toMatch(/medusaFetch\("\/store\/returns"/)
  })
})
