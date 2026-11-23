import fs from "node:fs"
import path from "node:path"

import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import {
  AFFILIATE_RESERVED_CODE,
  AFFILIATE_RESERVED_CODE_MESSAGE,
  affiliateRegisterError,
} from "@lib/util/affiliate-register-error"
import { MedusaApiError } from "@lib/util/medusa-api-error"

// AF-21 (spec 05 กฎ 45d, AC-53): 400 `invalid_data` ของ POST /affiliate/register เมื่อ code เป็นคำสงวน
// CORE-84 (spec 01 กฎข้อ 140, ADR-028): ตัดสินจาก code `AFFILIATE_CODE_RESERVED` ของ `MedusaApiError` ไม่ใช่ข้อความ
const FALLBACK = "ข้อความเดิม"
const THAI = /[฀-๿]/
const reserved = (overrides: object = {}) =>
  new MedusaApiError({ status: 400, type: "invalid_data", code: "AFFILIATE_CODE_RESERVED", message: "changed", ...overrides })

describe("affiliateRegisterError (กฎ 45d)", () => {
  it.each([
    ["MedusaApiError ของ medusaFetch", reserved()],
    ["object ที่มี status + code", { status: 400, code: "AFFILIATE_CODE_RESERVED" }],
  ])("%s → ข้อความไทยของคำสงวน", (_label, error) => {
    const message = affiliateRegisterError(error, FALLBACK)
    expect(message).toBe("รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น")
    expect(message).toMatch(THAI)
  })

  it.each([
    ["400 code อื่น", reserved({ code: "invalid_request_error" })],
    ["400 ไม่มี code (ข้อความคำสงวนแบบเดิม)", reserved({ code: null, message: "Invalid request: This referral code is reserved" })],
    ["FetchError ของ js-sdk (ไม่มี code)", new FetchError("Invalid request: This referral code is reserved", "Bad Request", 400)],
    ["500 code เดียวกัน", reserved({ status: 500 })],
    ["null", null],
    ["string", "AFFILIATE_CODE_RESERVED"],
  ])("%s → ข้อความเดิม", (_label, error) => {
    expect(affiliateRegisterError(error, FALLBACK)).toBe(FALLBACK)
  })

  it("ข้อความไทยตรงกับ spec", () => {
    expect(AFFILIATE_RESERVED_CODE_MESSAGE).toBe("รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น")
  })
})

describe("contract: code คำสงวนของ POST /affiliate/register (AF-21, CORE-84)", () => {
  it("code ใน helper ตรงกับ errors.ts ของ backend และ middleware ของ register ใช้ code นั้น", () => {
    const backend = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../../../backend/src", file), "utf8")
    const [, backendCode] = backend("modules/affiliate/errors.ts").match(/AFFILIATE_CODE_RESERVED = "([^"]+)"/) ?? []
    expect(backendCode).toBe(AFFILIATE_RESERVED_CODE)
    expect(backend("api/affiliate/middlewares.ts")).toMatch(/RESERVED_CODE_MESSAGE, AFFILIATE_CODE_RESERVED\)/)
  })
})
