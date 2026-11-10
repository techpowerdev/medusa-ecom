import fs from "node:fs"
import path from "node:path"

import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import {
  AFFILIATE_RESERVED_CODE,
  AFFILIATE_RESERVED_CODE_MESSAGE,
  affiliateRegisterError,
} from "@lib/util/affiliate-register-error"

// AF-21 (spec 05 กฎ 45d, AC-53): 400 `invalid_data` ของ POST /affiliate/register เมื่อ code เป็นคำสงวน
// `FetchError` ของ js-sdk ไม่มี `code` จึงจับจากข้อความคงที่ (แบบ CORE-20d)
const FALLBACK = "ข้อความเดิม"
const THAI = /[฀-๿]/

describe("affiliateRegisterError (กฎ 45d)", () => {
  it.each([
    ["ข้อความของ Medusa", { status: 400, message: "Invalid request: This referral code is reserved" }],
    ["ตัวพิมพ์ต่างและมี . ท้าย", { status: 400, message: "invalid request: this referral code is reserved." }],
    ["FetchError ของ js-sdk", new FetchError("Invalid request: This referral code is reserved", "Bad Request", 400)],
  ])("%s → ข้อความไทยของคำสงวน", (_label, error) => {
    const message = affiliateRegisterError(error, FALLBACK)
    expect(message).toBe("รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น")
    expect(message).toMatch(THAI)
  })

  it.each([
    ["400 ข้อความอื่น", { status: 400, message: "Invalid request: code must be a 3-32 char lowercase slug" }],
    ["500 ข้อความเดียวกัน", { status: 500, message: "This referral code is reserved" }],
    ["null", null],
    ["string", "This referral code is reserved"],
  ])("%s → ข้อความเดิม", (_label, error) => {
    expect(affiliateRegisterError(error, FALLBACK)).toBe(FALLBACK)
  })

  it("ข้อความไทยตรงกับ spec", () => {
    expect(AFFILIATE_RESERVED_CODE_MESSAGE).toBe("รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น")
  })
})

describe("contract: ข้อความคำสงวนของ POST /affiliate/register (AF-21)", () => {
  it("ข้อความใน helper ตรงกับใน validators.ts ของ backend", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../../../backend/src/api/affiliate/validators.ts"), "utf8")
    const [, backendMessage] = source.match(/RESERVED_CODE_MESSAGE = "([^"]+)"/) ?? []
    expect(backendMessage).toBe(AFFILIATE_RESERVED_CODE)
  })
})
