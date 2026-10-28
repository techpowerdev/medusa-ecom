import { MathBN } from "@medusajs/framework/utils"
import {
  memberPaymentAmount,
  paymentCapturedAction,
  shouldExpireMembershipPayment,
} from "../utils/membership-payment"

// spec 04 กฎข้อ 20 (AC-37): ยอด payment collection = order.total ปัด 2 ตำแหน่งแบบ half-up ด้วย MathBN
describe("memberPaymentAmount", () => {
  it.each([
    ["699.9999999999999999999983", "700"],
    ["699.994999", "699.99"],
    ["699.995", "700"],
    ["0.005", "0.01"],
    ["350", "350"],
  ])("%s → %s", (total, expected) => {
    expect(MathBN.eq(memberPaymentAmount(total), expected)).toBe(true)
  })

  it("accepts Medusa raw amount objects", () => {
    expect(MathBN.eq(memberPaymentAmount({ value: "123.4550000001", precision: 20 }), "123.46")).toBe(true)
  })
})

// spec 04 Workflows: payment.captured → paid + convert; idempotent ผ่าน status ของ membership
describe("paymentCapturedAction", () => {
  it.each([
    ["awaiting_payment", ["completed"], "mark_paid"],
    ["awaiting_payment", ["canceled", "completed"], "mark_paid"],
    ["awaiting_payment", ["partially_captured"], "noop"],
    ["awaiting_payment", ["authorized"], "noop"],
    ["paid", ["completed"], "noop"],
    ["cancelled", ["completed"], "orphan"],
    ["joined", ["completed"], "orphan"],
  ] as const)("%s with %j = %s", (status, collections, expected) => {
    expect(paymentCapturedAction(status, [...collections])).toEqual(expected)
  })
})

// spec 04 job: awaiting_payment ที่ pay_deadline_at <= now → ยกเลิก (AC-10) — ไม่ยกเลิก order ที่มีเงินเข้าแล้ว
describe("shouldExpireMembershipPayment", () => {
  const now = new Date("2026-10-28T10:00:00Z")
  const past = "2026-10-28T09:59:59Z"

  it("expires an unpaid awaiting_payment membership past its deadline", () => {
    expect(shouldExpireMembershipPayment("awaiting_payment", past, now, ["not_paid"])).toBe(true)
    expect(shouldExpireMembershipPayment("awaiting_payment", now, now, ["awaiting"])).toBe(true)
  })

  it("keeps it before the deadline or without a deadline", () => {
    expect(shouldExpireMembershipPayment("awaiting_payment", "2026-10-28T10:00:01Z", now, ["not_paid"])).toBe(false)
    expect(shouldExpireMembershipPayment("awaiting_payment", null, now, ["not_paid"])).toBe(false)
  })

  it.each(["authorized", "partially_authorized", "partially_captured", "completed"])(
    "keeps it when a collection is %s (payment.captured subscriber settles it)",
    (status) => {
      expect(shouldExpireMembershipPayment("awaiting_payment", past, now, ["not_paid", status])).toBe(false)
    }
  )

  it.each(["joined", "paid", "cancelled"] as const)("ignores %s memberships", (status) => {
    expect(shouldExpireMembershipPayment(status, past, now, ["not_paid"])).toBe(false)
  })
})
