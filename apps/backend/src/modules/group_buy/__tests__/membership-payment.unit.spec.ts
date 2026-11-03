import { MathBN } from "@medusajs/framework/utils"
import {
  convertedOrderAction,
  memberPaymentAmount,
  paidWithoutOrderAlertKey,
  paymentCapturedAction,
  shouldSendPaidWithoutOrderAlert,
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

// GB-9 กฎข้อ 25 (AC-43): อ่านสถานะใหม่ก่อนส่ง alert เงินค้าง — ส่งเฉพาะเมื่อยังเป็นเงินค้างจริง
describe("shouldSendPaidWithoutOrderAlert", () => {
  it.each([
    ["convert_failed", "awaiting_payment", false, false],
    ["convert_failed", "paid", true, false],
    ["convert_failed", "paid", false, false],
    ["convert_failed", "awaiting_payment", true, true],
    ["membership_cancelled", "cancelled", true, true],
    ["membership_cancelled", "awaiting_payment", true, false],
    ["membership_cancelled", "paid", false, false],
    // GB-10 (กฎข้อ 25e, AC-44 รอบ 13): capture มาตอน membership ยัง `joined` → orphan เหตุ membership_joined
    ["membership_joined", "joined", true, true],
    ["membership_joined", "awaiting_payment", true, false],
    ["membership_joined", "paid", false, false],
  ] as const)("%s + membership %s + is_draft_order=%s → %s", (reason, status, isDraft, expected) => {
    expect(shouldSendPaidWithoutOrderAlert(reason, { membership_status: status, is_draft_order: isDraft })).toBe(expected)
  })
})

describe("paidWithoutOrderAlertKey", () => {
  it("= <membership_id>:<reason> (membership เดียวเจอทั้งสองเหตุได้ 2 ฉบับ)", () => {
    expect(paidWithoutOrderAlertKey("gbmem_1", "convert_failed")).toEqual("gbmem_1:convert_failed")
    expect(paidWithoutOrderAlertKey("gbmem_1", "membership_cancelled")).toEqual("gbmem_1:membership_cancelled")
  })
})

// GB-10 กฎข้อ 26 (AC-44): ops แปลง draft order เอง → membership paid เฉพาะ awaiting_payment + แปลงแล้ว + collection completed
describe("convertedOrderAction", () => {
  it.each([
    ["awaiting_payment", false, ["completed"], "mark_paid"],
    ["awaiting_payment", false, ["canceled", "completed"], "mark_paid"],
    ["awaiting_payment", false, ["not_paid"], "noop"],
    ["awaiting_payment", false, [], "noop"],
    ["awaiting_payment", true, ["completed"], "noop"],
    ["paid", false, ["completed"], "noop"],
    ["joined", false, ["completed"], "noop"],
    ["cancelled", false, ["completed"], "noop"],
  ] as const)("membership %s + is_draft_order=%s + collections %j → %s", (status, isDraft, collections, expected) => {
    expect(convertedOrderAction(status, isDraft, [...collections])).toEqual(expected)
  })
})
