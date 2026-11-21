import { expect, test } from "@playwright/test"

import { medusaRefundSettled } from "./refund-settled"

// hotfix PAY-9 (AC-22c): สถานะจริงจาก trace ของ CI ที่ล้ม (run 44902940179 / 44896944640) หลัง Stripe มี refund แล้ว
// Medusa ยังทำ compensation ไม่จบ — payment ยังไม่บันทึก refund หรือ session ชั่วคราวจาก recreate (data = PI เดิม) ยังอยู่
const captured = { captures: [{ amount: 810 }], refunds: [] as { amount: number }[] }
const refunded = { captures: [{ amount: 810 }], refunds: [{ amount: 810 }] }

test("webhook ยังไม่สร้าง payment → ยังไม่จบ", () => {
  expect(medusaRefundSettled(undefined, [{ status: "pending" }])).toBe(false)
})

test("Stripe คืนแล้วแต่ Medusa ยังไม่บันทึก refund (session เดิม authorized — 12:45:23.455) → ยังไม่จบ", () => {
  expect(medusaRefundSettled(captured, [{ status: "authorized" }])).toBe(false)
})

test("บันทึก refund แล้วแต่ session ชั่วคราวของ recreate ยังรอชำระ (pending, PI เดิม — 12:45:23.657) → ยังไม่จบ", () => {
  expect(medusaRefundSettled(refunded, [{ status: "pending" }])).toBe(false)
  expect(medusaRefundSettled(refunded, [{ status: "authorized" }, { status: "requires_more" }])).toBe(false)
})

test("คืนครบและไม่มี session ที่รอชำระ (12:45:23.976) → จบ", () => {
  expect(medusaRefundSettled(refunded, [])).toBe(true)
  expect(medusaRefundSettled(refunded, [{ status: "authorized" }])).toBe(true)
})

test("คืนไม่ครบหรือไม่เคย capture → ยังไม่จบ", () => {
  expect(medusaRefundSettled({ captures: [{ amount: 810 }], refunds: [{ amount: 800 }] }, [])).toBe(false)
  expect(medusaRefundSettled({ captures: [], refunds: [] }, [])).toBe(false)
  expect(medusaRefundSettled({ captures: null, refunds: null }, [])).toBe(false)
})
