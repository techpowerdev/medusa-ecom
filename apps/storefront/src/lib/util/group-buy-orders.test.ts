import { describe, expect, it } from "vitest"

import { GroupBuyMembership, groupBuyMembershipView } from "./group-buy-orders"

const NOW = Date.parse("2026-11-03T10:00:00Z")
const LATER = "2026-11-04T10:00:00Z"
const EARLIER = "2026-11-02T10:00:00Z"

type Opts = {
  status?: string
  group?: string
  ends_at?: string | null
  pay_deadline_at?: string | null
  is_draft_order?: boolean
}

const membership = ({
  status = "joined",
  group = "open",
  ends_at = LATER,
  pay_deadline_at = null,
  is_draft_order = true,
}: Opts = {}): GroupBuyMembership => ({
  id: "gbmem_1",
  status,
  units: 1,
  joined_at: EARLIER,
  order_id: "order_1",
  group: { id: "gbgrp_1", status: group, ends_at, pay_deadline_at, join_token: "tok" },
  campaign: { id: "gbcmp_1", name: "แคมเปญ" },
  order: { id: "order_1", display_id: 7, status: "pending", is_draft_order, currency_code: "thb", total: 630 },
})

describe("groupBuyMembershipView (spec 04 Storefront: รอกลุ่ม / ชำระเงินภายใน / ชำระแล้ว / ยกเลิก)", () => {
  it("joined + กลุ่ม open ยังไม่หมดเวลา → waiting และออกจากกลุ่มได้ (กฎข้อ 13)", () => {
    expect(groupBuyMembershipView(membership(), NOW)).toEqual({ kind: "waiting", canLeave: true })
  })

  it("joined แต่กลุ่มหมดเวลาแล้ว (job ยังไม่ตัดสิน) → waiting แต่ออกไม่ได้", () => {
    expect(groupBuyMembershipView(membership({ ends_at: EARLIER }), NOW)).toEqual({ kind: "waiting", canLeave: false })
  })

  it("joined แต่กลุ่มไม่ open แล้ว → ออกไม่ได้", () => {
    expect(groupBuyMembershipView(membership({ group: "succeeded" }), NOW).canLeave).toBe(false)
  })

  it("awaiting_payment ก่อน pay_deadline_at → pay พร้อม deadline", () => {
    expect(
      groupBuyMembershipView(membership({ status: "awaiting_payment", group: "succeeded", pay_deadline_at: LATER }), NOW)
    ).toEqual({ kind: "pay", deadline: LATER, canLeave: false })
  })

  it("awaiting_payment เลย pay_deadline_at หรือไม่มี deadline → expired (ไม่มีลิงก์ชำระ)", () => {
    const m = membership({ status: "awaiting_payment", group: "succeeded", pay_deadline_at: EARLIER })
    expect(groupBuyMembershipView(m, NOW)).toEqual({ kind: "expired", canLeave: false })
    expect(groupBuyMembershipView({ ...m, group: { ...m.group!, pay_deadline_at: null } }, NOW).kind).toBe("expired")
  })

  it("paid → paid; ถ้า order แปลงแล้วมีลิงก์รายละเอียด order ปกติ", () => {
    expect(groupBuyMembershipView(membership({ status: "paid", is_draft_order: false }), NOW)).toEqual({
      kind: "paid",
      canLeave: false,
      orderDetails: true,
    })
    expect(groupBuyMembershipView(membership({ status: "paid", is_draft_order: true }), NOW)).toEqual({
      kind: "paid",
      canLeave: false,
      orderDetails: false,
    })
  })

  it("cancelled → cancelled", () => {
    expect(groupBuyMembershipView(membership({ status: "cancelled", group: "failed" }), NOW)).toEqual({
      kind: "cancelled",
      canLeave: false,
    })
  })

  it("กลุ่ม/order เป็น null (ข้อมูลหาย) ไม่ throw", () => {
    const m = { ...membership({ status: "awaiting_payment" }), order: null }
    expect(() => groupBuyMembershipView(m, NOW)).not.toThrow()
  })
})
