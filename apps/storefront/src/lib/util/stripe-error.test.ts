import { describe, expect, it } from "vitest"

import { STRIPE_CARD_DECLINED, STRIPE_CARD_INVALID, STRIPE_PAYMENT_FAILED, stripeErrorMessage } from "./stripe-error"

// PAY-17 (spec 06 กฎข้อ 19a, AC-30a): error ของ stripe.confirmPayment ขั้น review → ข้อความไทยตาม type/code
// ไม่แสดง `message` ของ Stripe (ภาษาอังกฤษ/ตาม locale ของ Elements — ขัด ADR-014)
const THAI = /[฀-๿]/
const ENGLISH = /[A-Za-z]/

describe("stripeErrorMessage", () => {
  it.each([
    ["card_declined", { type: "card_error", code: "card_declined", decline_code: "generic_decline" }],
    ["insufficient_funds (decline_code)", { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" }],
    ["ไม่มี code แต่มี decline_code", { type: "card_error", decline_code: "do_not_honor" }],
  ])("บัตรถูกปฏิเสธ: %s → STRIPE_CARD_DECLINED", (_label, error) => {
    expect(stripeErrorMessage({ ...error, message: "Your card was declined." })).toBe(STRIPE_CARD_DECLINED)
  })

  it.each([
    "incorrect_number",
    "invalid_number",
    "invalid_expiry_month",
    "invalid_expiry_year",
    "expired_card",
    "incorrect_cvc",
    "invalid_cvc",
    "incorrect_zip",
  ])("ข้อมูลบัตรผิด card_error/%s → STRIPE_CARD_INVALID", (code) => {
    expect(stripeErrorMessage({ type: "card_error", code, message: "Your card number is incorrect." })).toBe(
      STRIPE_CARD_INVALID
    )
  })

  it("validation_error (ช่องใน Elements ไม่ครบ) → STRIPE_CARD_INVALID", () => {
    expect(stripeErrorMessage({ type: "validation_error", code: "incomplete_number", message: "Your card number is incomplete." })).toBe(
      STRIPE_CARD_INVALID
    )
  })

  it.each([
    ["card_error อื่น", { type: "card_error", code: "processing_error" }],
    ["3DS ไม่ผ่าน", { type: "invalid_request_error", code: "payment_intent_authentication_failure" }],
    ["api_error", { type: "api_error" }],
    ["ไม่มี type", {}],
  ])("%s → STRIPE_PAYMENT_FAILED", (_label, error) => {
    expect(stripeErrorMessage({ ...error, message: "An error occurred while processing your card." })).toBe(STRIPE_PAYMENT_FAILED)
  })

  it("ข้อความทุกแบบเป็นอักษรไทย ไม่มีอักษรอังกฤษ และไม่ซ้ำกัน", () => {
    const all = [STRIPE_CARD_DECLINED, STRIPE_CARD_INVALID, STRIPE_PAYMENT_FAILED]
    for (const text of all) {
      expect(text).toMatch(THAI)
      expect(text).not.toMatch(ENGLISH)
    }
    expect(new Set(all).size).toBe(3)
  })
})
