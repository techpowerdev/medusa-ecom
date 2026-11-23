import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS, OUT_OF_STOCK, REFUNDED_NOTICE } from "./checkout-error"
import { CART_COMPLETION_IN_PROGRESS, PROMOTION_REFUNDED_NOTICE, placeOrderOutcome } from "./place-order-outcome"
import { PROMPTPAY_REFUNDED_UNKNOWN, promptPayFinishAction } from "./promptpay-finish"

// PAY-11 (spec 06 กฎข้อ 13, AC-24): ผลของ placeOrder ในทางสำรอง PromptPay (finish) → สิ่งที่ component ทำ
// refunded → หยุด poll + `promptpay-refunded` ข้อความกฎข้อ 27 ของ spec 03; processing / failed / network → poll ต่อ; 401/403 → login
const THAI = /[\u0E00-\u0E7F]/
const conflict = (code: string) => {
  const c = CHECKOUT_CONFLICTS.find((x) => x.code === code)!
  return { status: 409, code: c.code, message: "x" }
}

describe("promptPayFinishAction", () => {
  it.each(["FLASH_SOLD_OUT", "FLASH_LIMIT_EXCEEDED"])("409 %s → refunded พร้อมข้อความคืนเงินของกฎข้อ 27", (code) => {
    const action = promptPayFinishAction(placeOrderOutcome(conflict(code)))
    expect(action).toEqual({ kind: "refunded", text: REFUNDED_NOTICE, goToCart: true })
  })

  it("สต็อกไม่พอตอน complete (OUT_OF_STOCK) → refunded ข้อความกฎข้อ 27", () => {
    const action = promptPayFinishAction({ kind: "refunded", code: OUT_OF_STOCK })
    expect(action).toEqual({ kind: "refunded", text: REFUNDED_NOTICE, goToCart: true })
  })

  it("PROMOTION_NOT_COMBINABLE → refunded ข้อความเหตุโปรโมชัน (CORE-76)", () => {
    const action = promptPayFinishAction({ kind: "refunded", code: "PROMOTION_NOT_COMBINABLE" })
    expect(action).toEqual({ kind: "refunded", text: PROMOTION_REFUNDED_NOTICE, goToCart: true })
  })

  it("ข้อความ refunded เป็นภาษาไทย มีคำว่า คืนเงิน", () => {
    const action = promptPayFinishAction({ kind: "refunded", code: "FLASH_SOLD_OUT" })
    expect(action.kind).toBe("refunded")
    const text = (action as { text: string }).text
    expect(text).toMatch(THAI)
    expect(text).toContain("คืนเงิน")
  })

  it("409 CART_COMPLETION_IN_PROGRESS → retry (poll ต่อ ไม่แสดง refunded)", () => {
    const outcome = placeOrderOutcome({ status: 409, code: CART_COMPLETION_IN_PROGRESS })
    expect(outcome).toEqual({ kind: "processing" })
    expect(promptPayFinishAction(outcome)).toEqual({ kind: "retry" })
  })

  it.each([
    ["5xx", { status: 500, message: "boom" }],
    ["network (ไม่มี status)", new Error("fetch failed")],
    ["409 อื่นที่ไม่อยู่ใน allow-list", { status: 409, message: "something else" }],
  ])("%s → retry (PAY-6b)", (_label, error) => {
    expect(promptPayFinishAction(placeOrderOutcome(error))).toEqual({ kind: "retry" })
  })

  it.each([401, 403])("%s → unauthorized (login ใหม่)", (status) => {
    expect(promptPayFinishAction(placeOrderOutcome({ status }))).toEqual({ kind: "unauthorized" })
  })

  it("placeOrder ไม่คืนค่า (ได้ order = redirect) → retry", () => {
    expect(promptPayFinishAction(undefined)).toEqual({ kind: "retry" })
  })

  // PAY-15 (กฎข้อ 17, AC-28): refunded ที่รู้เหตุ → ไปตะกร้า (ไม่มีปุ่มเริ่มชำระใหม่บนตะกร้าเดิม); PAY-6c ไม่รู้เหตุ → คงปุ่มเริ่มชำระใหม่
  it.each(["FLASH_SOLD_OUT", "FLASH_LIMIT_EXCEEDED", OUT_OF_STOCK, "PROMOTION_NOT_COMBINABLE"])(
    "refunded รู้เหตุ %s → goToCart (ซ่อนเริ่มชำระใหม่)",
    (code) => {
      const action = promptPayFinishAction({ kind: "refunded", code })
      expect(action).toMatchObject({ kind: "refunded", goToCart: true })
    }
  )

  it("refunded ไม่รู้เหตุ (PAY-6c) → ไม่ไปตะกร้า คงข้อความเดิมที่ชวนกดเริ่มชำระใหม่", () => {
    expect(PROMPTPAY_REFUNDED_UNKNOWN.goToCart).toBe(false)
    expect(PROMPTPAY_REFUNDED_UNKNOWN.text).toBe(
      "ชำระไม่สำเร็จ เงินจะคืนเข้าบัญชีของคุณตามรอบของธนาคาร กดเริ่มชำระใหม่เพื่อรับคิวอาร์โค้ดใหม่"
    )
  })
})
