import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS, REVIEW_REFUNDED_NOTICE, checkoutConflictMessage } from "./checkout-error"
import { MedusaApiError } from "./medusa-api-error"

// FS-15 (spec 03 กฎข้อ 20c, AC-22): 409 ตอน complete cart → ข้อความไทยเฉพาะของแต่ละ code
// CORE-82 (spec 01 กฎข้อ 140, ADR-028): จับคู่ด้วย `code` ของ `MedusaApiError` เท่านั้น — ข้อความของ backend ไม่มีผล
const apiError = (message: string, code: string | null = null, status = 409) =>
  new MedusaApiError({ status, type: "conflict", code, message })

const THAI = /[฀-๿]/

describe("checkoutConflictMessage", () => {
  it("map ครบ 3 code: FLASH_SOLD_OUT, FLASH_LIMIT_EXCEEDED, PROMOTION_NOT_COMBINABLE", () => {
    expect(CHECKOUT_CONFLICTS.map((c) => c.code).sort()).toEqual([
      "FLASH_LIMIT_EXCEEDED",
      "FLASH_SOLD_OUT",
      "PROMOTION_NOT_COMBINABLE",
    ])
  })

  it.each(CHECKOUT_CONFLICTS)(
    "$code: จับคู่ด้วย code → ข้อความไทย",
    ({ code, text }) => {
      const byCode = checkoutConflictMessage(apiError("x", code))
      expect(byCode).toBe(text)
      expect(byCode).toMatch(THAI)
      expect(checkoutConflictMessage({ code })).toBe(text)
    }
  )

  it("ข้อความของแต่ละ code ต่างกันทั้งหมด (FLASH_SOLD_OUT ≠ FLASH_LIMIT_EXCEEDED)", () => {
    const texts = CHECKOUT_CONFLICTS.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it("ข้อความของ backend แต่ไม่มี code → null (ไม่เทียบข้อความแล้ว — CORE-82)", () => {
    expect(checkoutConflictMessage(apiError("This flash sale is sold out"))).toBeNull()
    expect(checkoutConflictMessage(new Error("This flash sale is sold out"))).toBeNull()
  })

  it("error อื่น / ไม่ใช่ error → null (ผู้เรียกใช้ข้อความเดิม)", () => {
    expect(checkoutConflictMessage(apiError("Payment sessions are required", "SOMETHING_ELSE"))).toBeNull()
    expect(checkoutConflictMessage(null)).toBeNull()
    expect(checkoutConflictMessage("FLASH_SOLD_OUT")).toBeNull()
  })
})

// PAY-19 (spec 06 กฎข้อ 21a — owner Q-P16 2026-11-24): notice ขั้น review หลัง reload ไม่รู้ว่าจ่ายด้วยวิธีไหน (collection ไม่มี session)
// → บอกทั้งสองทาง: บัตรเข้าบัญชีตามรอบธนาคาร, พร้อมเพย์ตรวจอีเมลเพื่อกรอกบัญชีรับเงินคืน
describe("REVIEW_REFUNDED_NOTICE", () => {
  it("ไทย ไม่มีคำละติน บอกทางของบัตรและพร้อมเพย์", () => {
    expect(REVIEW_REFUNDED_NOTICE).toMatch(THAI)
    expect(REVIEW_REFUNDED_NOTICE).not.toMatch(/[A-Za-z]{2,}/)
    expect(REVIEW_REFUNDED_NOTICE).toMatch(/บัตร[^]*ตามรอบของธนาคาร/)
    expect(REVIEW_REFUNDED_NOTICE).toMatch(/พร้อมเพย์[^]*ตรวจอีเมล/)
  })
})
