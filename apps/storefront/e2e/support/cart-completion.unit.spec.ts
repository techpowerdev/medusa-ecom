import { expect, test } from "@playwright/test"

import { cartCompletionSettled } from "./cart-completion"

// hotfix PAY-9 (AC-22c): สถานะ execution ของ complete-cart ที่ integration test ยืนยัน (complete-after-payment-log.spec.ts)
// ตอน Stripe refund: refund ถูกบันทึกแล้ว + session เดิม authorized แต่ execution ยัง waiting_to_compensate
const CART = "cart_pay9"
const run = (state: string, id = CART) => ({ state, context: { data: { payload: { id } } } })

test("ยังไม่มี execution ของ cart นี้ → ยังไม่จบ", () => {
  expect(cartCompletionSettled([], CART)).toBe(false)
  expect(cartCompletionSettled([run("reverted", "cart_other")], CART)).toBe(false)
})

test("Stripe คืนเงินแล้วแต่ compensation ยังทำงาน (waiting_to_compensate) → ยังไม่จบ", () => {
  expect(cartCompletionSettled([run("waiting_to_compensate")], CART)).toBe(false)
})

test("complete ของ storefront จบแล้ว แต่ complete ที่ webhook สั่งยังไม่จบ → ยังไม่จบ", () => {
  expect(cartCompletionSettled([run("reverted"), run("not_started")], CART)).toBe(false)
  expect(cartCompletionSettled([run("reverted"), run("compensating")], CART)).toBe(false)
  expect(cartCompletionSettled([run("reverted"), run("invoking")], CART)).toBe(false)
})

test("ทุก execution ของ cart นี้อยู่ในสถานะจบ → จบ (execution ของ cart อื่นไม่นับ)", () => {
  expect(cartCompletionSettled([run("reverted"), run("reverted"), run("invoking", "cart_other")], CART)).toBe(true)
  expect(cartCompletionSettled([run("done")], CART)).toBe(true)
  expect(cartCompletionSettled([run("failed"), { state: "invoking", context: null }], CART)).toBe(true)
})
