import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS, checkoutConflictMessage } from "./checkout-error"

// FS-15 (spec 03 กฎข้อ 20c, AC-22): 409 ตอน complete cart → ข้อความไทยเฉพาะของแต่ละ code
// `FetchError` ของ js-sdk 2.22.1 เก็บแค่ message/status ไม่มี `code` → จับคู่ด้วยข้อความคงที่ของ backend
const fetchError = (message: string, status = 409) =>
  Object.assign(new Error(message), { status, statusText: "Conflict" })

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
    "$code: จับคู่ด้วย message ของ backend และด้วย code → ข้อความไทย ไม่มีข้อความอังกฤษของ backend",
    ({ code, message, text }) => {
      const byMessage = checkoutConflictMessage(fetchError(message))
      expect(byMessage).toBe(text)
      expect(byMessage).toMatch(THAI)
      expect(byMessage).not.toContain(message)
      expect(checkoutConflictMessage(Object.assign(fetchError("x"), { code }))).toBe(text)
    }
  )

  it("ข้อความของแต่ละ code ต่างกันทั้งหมด (FLASH_SOLD_OUT ≠ FLASH_LIMIT_EXCEEDED)", () => {
    const texts = CHECKOUT_CONFLICTS.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it("message ที่ medusaError แต่งแล้ว (ตัวใหญ่ + จุดท้าย) ยังจับคู่ได้", () => {
    const soldOut = CHECKOUT_CONFLICTS.find((c) => c.code === "FLASH_SOLD_OUT")!
    expect(checkoutConflictMessage(new Error(`${soldOut.message}.`))).toBe(soldOut.text)
  })

  it("error อื่น / ไม่ใช่ error → null (ผู้เรียกใช้ข้อความเดิม)", () => {
    expect(checkoutConflictMessage(fetchError("Payment sessions are required"))).toBeNull()
    expect(checkoutConflictMessage(null)).toBeNull()
    expect(checkoutConflictMessage("FLASH_SOLD_OUT")).toBeNull()
  })
})
