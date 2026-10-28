import { describe, expect, it } from "vitest"

import {
  GroupBuyOrder,
  hasPayment,
  orderPayView,
  paymentSettled,
  sessionCreateOutcome,
} from "./order-pay"

const NOW = Date.parse("2026-10-28T10:00:00Z")
const LATER = "2026-10-29T10:00:00Z"
const EARLIER = "2026-10-27T10:00:00Z"

type Opts = {
  payment_status?: string
  collection?: string
  session?: string
  membership?: string
  deadline?: string | null
  collections?: boolean
}

const data = ({
  payment_status = "not_paid",
  collection = "not_paid",
  session,
  membership = "awaiting_payment",
  deadline = LATER,
  collections = true,
}: Opts = {}): GroupBuyOrder => ({
  membership: { id: "gbm_1", status: membership, units: 1 },
  group: { id: "gbg_1", status: "succeeded", ends_at: EARLIER, pay_deadline_at: deadline },
  order: {
    id: "order_1",
    display_id: 1,
    currency_code: "thb",
    total: 100,
    payment_status,
    items: [],
    payment_collections: collections
      ? [
          {
            id: "pay_col_1",
            amount: 100,
            status: collection,
            payment_sessions: session
              ? [{ id: "payses_1", provider_id: "pp_stripe_stripe", status: session, amount: 100, data: {} }]
              : [],
          },
        ]
      : [],
  },
})

// spec 06 กฎข้อ 9 d2 (AC-19): predicate "มีการชำระแล้ว" — ตารางกรณีจริง/เท็จครบทุกค่าที่กฎระบุ
describe("hasPayment", () => {
  it.each(["authorized", "captured"])("session %s → จริง (แม้ payment_status ยัง not_paid)", (session) => {
    expect(hasPayment(data({ session, payment_status: "not_paid" }))).toBe(true)
  })

  it.each(["authorized", "partially_authorized", "partially_captured", "completed"])(
    "collection %s → จริง",
    (collection) => {
      expect(hasPayment(data({ collection }))).toBe(true)
    }
  )

  it.each(["authorized", "partially_authorized", "partially_captured", "captured"])(
    "payment_status %s → จริง",
    (payment_status) => {
      expect(hasPayment(data({ payment_status }))).toBe(true)
    }
  )

  it.each(["not_paid", "awaiting", "requires_action", "canceled", "refunded", "partially_refunded"])(
    "payment_status %s + collection not_paid + session pending → เท็จ",
    (payment_status) => {
      expect(hasPayment(data({ payment_status, session: "pending" }))).toBe(false)
    }
  )

  it.each(["not_paid", "awaiting", "canceled", "failed"])("collection %s → เท็จ", (collection) => {
    expect(hasPayment(data({ collection }))).toBe(false)
  })

  it.each(["pending", "requires_more", "error", "canceled"])("session %s → เท็จ", (session) => {
    expect(hasPayment(data({ session }))).toBe(false)
  })

  it("refunded + collection not_paid → เท็จ (admin refund ไม่ใช่ผลของ race)", () => {
    expect(hasPayment(data({ payment_status: "refunded", collection: "not_paid" }))).toBe(false)
  })

  it("ไม่มี collection → เท็จ", () => {
    expect(hasPayment(data({ collections: false }))).toBe(false)
  })
})

// review #184 (nit): (d) หยุด poll เมื่อ captured หรือ collection completed เท่านั้น — authorized ยังไม่หยุด
describe("paymentSettled", () => {
  it("payment_status captured → จริง", () => {
    expect(paymentSettled(data({ payment_status: "captured" }))).toBe(true)
  })

  it("collection completed → จริง", () => {
    expect(paymentSettled(data({ collection: "completed" }))).toBe(true)
  })

  it.each([
    { session: "authorized", payment_status: "not_paid" },
    { session: "captured", payment_status: "not_paid" },
    { payment_status: "authorized" },
    { payment_status: "partially_captured", collection: "partially_captured" },
    { payment_status: "not_paid" },
  ])("%o → เท็จ (ยังต้อง poll ต่อ)", (opts) => {
    expect(paymentSettled(data(opts))).toBe(false)
  })
})

// spec 06 กฎข้อ 9 (b): ฟอร์มเฉพาะ awaiting_payment + ก่อนเส้นตาย + collection ยังไม่ completed
describe("orderPayView", () => {
  it("awaiting_payment ก่อนเส้นตาย มี collection not_paid → form", () => {
    expect(orderPayView(data(), NOW)).toBe("form")
  })

  it("collection completed → paid", () => {
    expect(orderPayView(data({ collection: "completed" }), NOW)).toBe("paid")
  })

  it("payment_status captured → paid", () => {
    expect(orderPayView(data({ payment_status: "captured" }), NOW)).toBe("paid")
  })

  it("membership paid → paid", () => {
    expect(orderPayView(data({ membership: "paid" }), NOW)).toBe("paid")
  })

  it("joined (กลุ่มยังไม่สำเร็จ) → waiting", () => {
    expect(orderPayView(data({ membership: "joined", collections: false, deadline: null }), NOW)).toBe("waiting")
  })

  it("cancelled → closed", () => {
    expect(orderPayView(data({ membership: "cancelled" }), NOW)).toBe("closed")
  })

  it("เลย pay_deadline_at → closed", () => {
    expect(orderPayView(data({ deadline: EARLIER }), NOW)).toBe("closed")
  })

  it("ตรงเส้นตายพอดี → closed (now < deadline เท่านั้น)", () => {
    expect(orderPayView(data({ deadline: new Date(NOW).toISOString() }), NOW)).toBe("closed")
  })

  it("awaiting_payment แต่ไม่มี collection → closed", () => {
    expect(orderPayView(data({ collections: false }), NOW)).toBe("closed")
  })
})

// spec 06 กฎข้อ 9 (d)/(d2): ไม่ดู status code อื่นนอกจาก 409 + code ของเรา และ 401
describe("sessionCreateOutcome", () => {
  it.each([200, 201])("%i → created", (status) => {
    expect(sessionCreateOutcome(status, null)).toBe("created")
  })

  it("409 PAYMENT_ALREADY_COMPLETED → already-paid", () => {
    expect(sessionCreateOutcome(409, "PAYMENT_ALREADY_COMPLETED")).toBe("already-paid")
  })

  it("401 → unauthorized", () => {
    expect(sessionCreateOutcome(401, null)).toBe("unauthorized")
  })

  it.each([
    [500, null],
    [400, null],
    [409, null],
    [409, "OTHER"],
    [403, null],
    [0, null], // network error
  ])("%i %s → check-status", (status, code) => {
    expect(sessionCreateOutcome(status, code)).toBe("check-status")
  })
})
