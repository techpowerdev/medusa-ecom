import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { FetchError } from "@medusajs/js-sdk"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MedusaApiError } from "@lib/util/medusa-api-error"

// CORE-84 (spec 01 กฎข้อ 140, AC-181 b กลุ่ม group buy/flash/affiliate + c, ADR-028): ตัดสิน error ด้วย code ของ `MedusaApiError`
// — join/สร้างทีม และ register ของ affiliate ผ่าน `medusaFetch`; ข้อความอังกฤษเปลี่ยนแล้วผลไม่เปลี่ยน
const medusaFetch = vi.fn()
const clientFetch = vi.fn()
const cookieSet = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/data/medusa-fetch", () => ({ medusaFetch: (...a: unknown[]) => medusaFetch(...a) }))
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => clientFetch(...a) } } }))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: async () => ({ authorization: "Bearer customer_jwt" }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: () => undefined, delete: vi.fn() }) }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url })
  },
}))

const apiError = (status: number, code: string | null, message = "changed wording", type = "conflict") =>
  new MedusaApiError({ status, type, code, message })

beforeEach(() => {
  medusaFetch.mockReset()
  clientFetch.mockReset()
  cookieSet.mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe("group buy: join/สร้างทีมตัดสินจาก code (AC-181 b)", () => {
  it("joinGroupBuy เรียก medusaFetch และ code ของ MedusaApiError → code นั้น แม้ข้อความเปลี่ยน", async () => {
    const { joinGroupBuy } = await import("@lib/data/group-join")
    medusaFetch.mockRejectedValue(apiError(409, "GB_GROUP_FULL"))
    expect(await joinGroupBuy("tok/1", "cart_1")).toEqual({ error: "GB_GROUP_FULL" })
    expect(medusaFetch).toHaveBeenCalledWith("/store/group-buy/groups/tok%2F1/join", { cart_id: "cart_1" })

    medusaFetch.mockReset().mockResolvedValue({})
    expect(await joinGroupBuy("tok", "cart_1")).toEqual({ ok: true })
  })

  it("400 GB_CART_EMPTY → empty_cart (ไม่เทียบ \"The cart has no items\")", async () => {
    const { groupJoinFailure } = await import("@lib/util/group-join-error")
    expect(groupJoinFailure(apiError(400, "GB_CART_EMPTY", "changed", "invalid_data"))).toEqual({ error: "empty_cart" })
    // ข้อความเดิมที่ไม่มี code → ไม่ใช่ empty_cart อีกต่อไป (400 อื่น = ปิดรับ)
    expect(groupJoinFailure(new FetchError("The cart has no items", "Bad Request", 400))).toEqual({ error: "closed" })
  })

  it("ข้อความเดิมของ backend ที่ไม่มี code (FetchError) ไม่ถูกแปลงเป็น code อีก", async () => {
    const { groupJoinErrorCode } = await import("@lib/util/group-join-error")
    expect(groupJoinErrorCode(new FetchError("The group is full", "Conflict", 409))).toBeNull()
    expect(groupJoinErrorCode({ status: 400, message: "GB_SHIPPING_PROFILE_NOT_COVERED: x" })).toBeNull()
  })

  it("createGroupBuyTeam เรียก medusaFetch และ 400 GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED → ข้อความของ code นั้น", async () => {
    const { createGroupBuyTeam } = await import("@lib/data/group-buy")
    const { groupJoinActionMessage } = await import("@lib/util/group-join-error")
    medusaFetch.mockRejectedValue(apiError(400, "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED", "changed", "invalid_data"))
    expect(await createGroupBuyTeam("gbc_1")).toEqual({
      error: "failed",
      message: groupJoinActionMessage("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED"),
    })
    expect(medusaFetch).toHaveBeenCalledWith("/store/group-buy/groups", { campaign_id: "gbc_1" })

    medusaFetch.mockReset().mockResolvedValue({ group: { join_token: "tok_9" } })
    expect(await createGroupBuyTeam("gbc_1")).toEqual({ ok: true, token: "tok_9" })
  })
})

describe("affiliate: register ตัดสินจาก code (AC-181 b)", () => {
  const form = (code = "admin") => {
    const f = new FormData()
    for (const [k, v] of Object.entries({ countryCode: "th", email: "Ann@X.th", password: "pw", name: "Ann", code })) {
      f.set(k, v)
    }
    return f
  }

  it("identity → /affiliate/register ผ่าน medusaFetch ด้วย token ของ affiliate (ไม่ใช่ JWT ลูกค้า)", async () => {
    medusaFetch.mockImplementation(async (p: string) => (p.startsWith("/auth/") ? { token: "aff_tok" } : {}))
    clientFetch.mockResolvedValue({ token: "aff_tok2" })
    const { affiliateRegister } = await import("@lib/data/affiliate-portal")
    await expect(affiliateRegister(null as never, form("ann"))).rejects.toMatchObject({ url: "/th/affiliate" })
    expect(medusaFetch.mock.calls).toEqual([
      ["/auth/affiliate/emailpass/register", { email: "ann@x.th", password: "pw" }, {}],
      ["/affiliate/register", { name: "Ann", code: "ann" }, { authorization: "Bearer aff_tok" }],
    ])
  })

  it("400 AFFILIATE_CODE_RESERVED → ข้อความไทยของคำสงวน แม้ข้อความอังกฤษเปลี่ยน", async () => {
    const { AFFILIATE_RESERVED_CODE_MESSAGE } = await import("@lib/util/affiliate-register-error")
    medusaFetch.mockImplementation(async (p: string) => {
      if (p.startsWith("/auth/")) return { token: "aff_tok" }
      throw apiError(400, "AFFILIATE_CODE_RESERVED", "changed", "invalid_data")
    })
    const { affiliateRegister } = await import("@lib/data/affiliate-portal")
    expect(await affiliateRegister(null as never, form())).toEqual({ error: AFFILIATE_RESERVED_CODE_MESSAGE })
  })

  it("ข้อความคำสงวนแบบเดิมที่ไม่มี code → ข้อความ fallback", async () => {
    const { affiliateRegisterError, AFFILIATE_RESERVED_CODE_MESSAGE } = await import("@lib/util/affiliate-register-error")
    const old = new FetchError("Invalid request: This referral code is reserved", "Bad Request", 400)
    expect(affiliateRegisterError(old, "fallback")).toBe("fallback")
    expect(affiliateRegisterError(apiError(400, "AFFILIATE_CODE_RESERVED"), "fallback")).toBe(AFFILIATE_RESERVED_CODE_MESSAGE)
  })

  it("identity มีอยู่แล้ว (IDENTITY_EXISTS) → login ด้วยรหัสผ่านเดิม; 401 อื่น → สมัครไม่สำเร็จ", async () => {
    const { affiliateRegister } = await import("@lib/data/affiliate-portal")
    medusaFetch.mockImplementation(async (p: string) => {
      if (p.startsWith("/auth/")) {
        throw new MedusaApiError({ status: 401, type: "unauthorized", message: "Identity with email already exists" })
      }
      return {}
    })
    clientFetch.mockResolvedValue({ token: "login_tok" })
    await expect(affiliateRegister(null as never, form("ann"))).rejects.toMatchObject({ url: "/th/affiliate" })
    expect(medusaFetch.mock.calls[1]).toEqual(["/affiliate/register", expect.anything(), { authorization: "Bearer login_tok" }])

    medusaFetch.mockReset().mockRejectedValue(new MedusaApiError({ status: 401, type: "unauthorized", message: "other" }))
    clientFetch.mockReset()
    expect(await affiliateRegister(null as never, form("ann"))).toEqual({ error: "สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" })
    expect(clientFetch).not.toHaveBeenCalled()
  })
})

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8")
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })

describe("contract: code ของ backend (AC-181 b)", () => {
  it("join.ts ใส่ code GB_CART_EMPTY ให้ cart ว่าง และ /affiliate/register ใส่ AFFILIATE_CODE_RESERVED", () => {
    expect(read("../../backend/src/modules/group_buy/utils/join.ts")).toMatch(
      /INVALID_DATA,\s*"The cart has no items",\s*GB_CART_EMPTY/
    )
    expect(read("../../backend/src/modules/group_buy/errors.ts")).toContain('GB_CART_EMPTY = "GB_CART_EMPTY"')
    expect(read("../../backend/src/modules/affiliate/errors.ts")).toContain(
      'AFFILIATE_CODE_RESERVED = "AFFILIATE_CODE_RESERVED"'
    )
  })
})

// AC-181 c: ทั้ง storefront ไม่เทียบข้อความ error ของ backend นอกข้อยกเว้นของ helper
describe("static: ไม่มีการเทียบข้อความ backend นอกข้อยกเว้น (AC-181 c)", () => {
  const ALLOWED = ["lib/util/medusa-api-error.ts", "lib/data/medusa-fetch.ts"]
  const COMPARE = /(?<!typeof )\bmessage\b\s*[!=]==?|\bmessage\??\.(includes|startsWith|endsWith|match|toLowerCase|trim)\(|\.test\(\s*(text|message)\b/
  const files = walk(__dirname).map((f) => path.relative(__dirname, f))

  it("ตรวจไฟล์ source ของ lib/modules/app (ไม่ว่าง)", () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files).toContain("lib/util/group-join-error.ts")
  })

  it.each(files.filter((f) => !ALLOWED.includes(f)))("%s", (file) => {
    expect(read(file)).not.toMatch(COMPARE)
  })

  it("normalize ของ checkout-error ถูกลบ (ไม่มีผู้ใช้เหลือ)", () => {
    expect(read("lib/util/checkout-error.ts")).not.toMatch(/export const normalize/)
  })

  it("ไม่มีข้อความอังกฤษของ backend กลุ่ม group buy/affiliate ใน source และ e2e ของกลุ่ม", () => {
    const ENGLISH = [
      "The group is full",
      "The cart has no items",
      "At most",
      "This referral code is reserved",
      "You are already in another group",
      "This cart was already used to join a group",
    ]
    const GROUP = [
      "lib/util/group-join-error.ts",
      "lib/util/affiliate-register-error.ts",
      "lib/data/group-join.ts",
      "lib/data/group-buy.ts",
      "lib/data/affiliate-portal.ts",
      "../e2e/group-buy-join.spec.ts",
      "../e2e/group-buy-home-campaigns.spec.ts",
      "../e2e/affiliate-portal.spec.ts",
    ]
    for (const file of GROUP) {
      const text = read(file).toLowerCase()
      for (const m of ENGLISH) expect(text, `${file}: ${m}`).not.toContain(m.toLowerCase())
    }
  })
})
