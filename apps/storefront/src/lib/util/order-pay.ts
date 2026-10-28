// PAY-3b (spec 06 กฎข้อ 9): logic ล้วนของหน้า /account/orders/:id/pay — อ่านจาก response ของ GB-8 เท่านั้น ไม่มี I/O
import { PAYMENT_ALREADY_COMPLETED } from "./payment-session"

export type GroupBuyPaymentSession = {
  id: string
  provider_id: string
  status: string
  amount: number
  data: { id?: string; client_secret?: string; status?: string }
}

/** response ของ `GET /store/customers/me/group-buy/orders/:order_id` (GB-8, ADR-016) */
export type GroupBuyOrder = {
  membership: { id: string; status: string; units: number }
  group: { id: string; status: string; ends_at: string | null; pay_deadline_at: string | null }
  order: {
    id: string
    display_id: number
    currency_code: string
    total: number
    payment_status: string
    items: { id: string; title: string; variant_title: string | null; quantity: number; total: number }[]
    payment_collections: {
      id: string
      amount: number
      status: string
      payment_sessions: GroupBuyPaymentSession[]
    }[]
  }
}

const PAID_SESSION = ["authorized", "captured"]
const PAID_COLLECTION = ["authorized", "partially_authorized", "partially_captured", "completed"]
const PAID_ORDER = ["authorized", "partially_authorized", "partially_captured", "captured"]

/**
 * predicate "มีการชำระแล้ว" (กฎข้อ 9 d/d2): มี payment บน PI แล้ว — สร้าง session ใหม่เสี่ยงตัดเงินซ้ำ
 * `refunded`/`partially_refunded` ไม่อยู่ในรายการ (admin refund หลัง capture ไม่ใช่ผลของ race ตอนสร้าง session)
 */
export function hasPayment({ order }: GroupBuyOrder): boolean {
  if (PAID_ORDER.includes(order.payment_status)) return true
  return order.payment_collections.some(
    (c) => PAID_COLLECTION.includes(c.status) || c.payment_sessions.some((s) => PAID_SESSION.includes(s.status))
  )
}

/** หยุด poll เมื่อ capture แล้วเท่านั้น (review #184) — session `authorized` + `not_paid` ยังต้องรอ */
export const paymentSettled = ({ order }: GroupBuyOrder) =>
  order.payment_status === "captured" || order.payment_collections.some((c) => c.status === "completed")

/** collection ที่ยังชำระได้ (กฎข้อ 9 b) */
export const payableCollection = ({ order }: GroupBuyOrder) =>
  order.payment_collections.find((c) => c.status !== "completed")

export type OrderPayView = "paid" | "form" | "waiting" | "closed"

/** กฎข้อ 9 (b): ฟอร์มเฉพาะ awaiting_payment + now < pay_deadline_at + มี collection ที่ยังไม่ completed */
export function orderPayView(data: GroupBuyOrder, nowMs: number): OrderPayView {
  if (data.membership.status === "paid" || paymentSettled(data)) return "paid"
  if (data.membership.status === "joined") return "waiting"
  const deadline = data.group.pay_deadline_at ? Date.parse(data.group.pay_deadline_at) : NaN
  const open = data.membership.status === "awaiting_payment" && nowMs < deadline
  return open && payableCollection(data) ? "form" : "closed"
}

export type SessionCreateOutcome = "created" | "already-paid" | "unauthorized" | "check-status"

/**
 * ผลของ `POST /store/payment-collections/:id/payment-sessions` (`status` 0 = network error):
 * 409 + code ของ guard → (d) poll GB-8; 401 → login; non-2xx อื่นทุกแบบ → (d2) ตัดสินจากสถานะ GB-8 ไม่ดู code/ข้อความ
 */
export function sessionCreateOutcome(status: number, code: string | null): SessionCreateOutcome {
  if (status >= 200 && status < 300) return "created"
  if (status === 409 && code === PAYMENT_ALREADY_COMPLETED) return "already-paid"
  if (status === 401) return "unauthorized"
  return "check-status"
}
