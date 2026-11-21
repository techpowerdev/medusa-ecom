import { hasUnpaidSession, isFullyRefundedCollection } from "../refunded-payments"

// PAY-9 (spec 06 กฎข้อ 11, ADR-025): collection ที่ payment ทุกตัว (ไม่นับที่ถูกยกเลิก) capture แล้วถูกคืนครบ — MathBN จาก raw_amount
const raw = (value: string) => ({ raw_amount: { value, precision: 20 } })
const payment = (captures: string[], refunds: string[], canceled_at: string | null = null) => ({
  canceled_at,
  captures: captures.map(raw),
  refunds: refunds.map(raw),
})

describe("isFullyRefundedCollection", () => {
  it.each([
    ["no payments", [], false],
    ["captured, not refunded (AC-13)", [payment(["600"], [])], false],
    ["captured, partially refunded", [payment(["600"], ["100"])], false],
    ["authorized, never captured", [payment([], [])], false],
    ["only a canceled payment", [payment([], [], "2026-11-21T00:00:00Z")], false],
    ["captured ฿600 and refunded ฿600", [payment(["600"], ["600"])], true],
    ["decimal refunds 100.10 + 200.20 = capture 300.30 (MathBN, not float)", [payment(["300.30"], ["100.10", "200.20"])], true],
    ["refunded one + a canceled one", [payment(["600"], ["600"]), payment([], [], "2026-11-21T00:00:00Z")], true],
    ["refunded one + another captured not refunded", [payment(["600"], ["600"]), payment(["600"], [])], false],
  ])("%s → %s", (_label, payments, expected) => {
    expect(isFullyRefundedCollection(payments as any)).toBe(expected)
  })

  it("tolerates null relations from query.graph", () => {
    expect(isFullyRefundedCollection(null)).toBe(false)
    expect(isFullyRefundedCollection([null, { captures: null, refunds: null }] as any)).toBe(false)
  })
})

// review #445 (เงิน): session ที่ยังไม่มี payment อาจเป็นการจ่ายที่ webhook ยังไม่มา — ห้าม reset
describe("hasUnpaidSession", () => {
  it.each([
    ["no sessions", [], false],
    ["null relation", null, false],
    ["only sessions that already have a payment", [{ id: "ps_1", payment: { id: "pay_1" } }], false],
    ["a session without a payment (any provider)", [{ id: "ps_1", payment: { id: "pay_1" } }, { id: "ps_2", payment: null }], true],
    ["a session whose payment relation is missing", [{ id: "ps_2" }], true],
  ])("%s → %s", (_label, sessions, expected) => {
    expect(hasUnpaidSession(sessions as any)).toBe(expected)
  })
})
