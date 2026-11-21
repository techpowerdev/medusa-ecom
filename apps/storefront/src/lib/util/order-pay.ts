// PAY-3b (spec 06 กฎข้อ 9): logic ล้วนของหน้า /account/orders/:id/pay — อ่านจาก response ของ GB-8 เท่านั้น ไม่มี I/O
import { type PaymentSessionResult, paymentSessionResult } from "./action-result"
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

/**
 * กฎข้อ 9 (b): ฟอร์มเฉพาะ awaiting_payment + now < pay_deadline_at + มี collection ที่ยังไม่ completed
 * GB-22 (spec 04 กฎข้อ 45a): membership `cancelled` → closed เสมอ แม้ collection completed (เงินเข้าหลังยกเลิกถูกคืนอัตโนมัติ — GB-21)
 */
export function orderPayView(data: GroupBuyOrder, nowMs: number): OrderPayView {
  if (data.membership.status === "cancelled") return "closed"
  if (data.membership.status === "paid" || paymentSettled(data)) return "paid"
  if (data.membership.status === "joined") return "waiting"
  const deadline = data.group.pay_deadline_at ? Date.parse(data.group.pay_deadline_at) : NaN
  const open = data.membership.status === "awaiting_payment" && nowMs < deadline
  return open && payableCollection(data) ? "form" : "closed"
}

export const REFUND_NOTICE_MESSAGE = "สิทธิ์นี้ถูกยกเลิกแล้ว หากมีการตัดเงิน ระบบคืนเงินเต็มจำนวนให้อัตโนมัติ (ตามรอบของธนาคาร)"

/** GB-22 (กฎข้อ 45a): สิทธิ์ยกเลิกแล้วแต่มีการชำระ → แสดงข้อความคืนเงิน (`order-pay-refund-notice`) */
export const showRefundNotice = (data: GroupBuyOrder) => data.membership.status === "cancelled" && hasPayment(data)

/** code ของ guard GB-20 (spec 04 กฎข้อ 42): สิทธิ์ชำระปิดแล้ว — ไม่มี session ถูกสร้าง */
export const GB_PAYMENT_CLOSED = "GB_PAYMENT_CLOSED"

export type OrderPaySessionResult = PaymentSessionResult | { error: typeof GB_PAYMENT_CLOSED }

/**
 * ผลของการสร้าง session ของหน้า pay: 400 + `GB_PAYMENT_CLOSED` → code นั้น (GB-22 กฎข้อ 45a); อื่นๆ ตาม helper กลาง
 * (`paymentSessionResult` — checkout ไม่ได้ code นี้ จึงไม่เพิ่มใน helper กลาง)
 */
export const orderPaySessionResult = (res: { status: number; code: string | null }): OrderPaySessionResult =>
  res.status === 400 && res.code === GB_PAYMENT_CLOSED ? { error: GB_PAYMENT_CLOSED } : paymentSessionResult(res)

export type SessionCreateOutcome = "created" | "already-paid" | "unauthorized" | "check-status" | "closed"

/**
 * ผลของ action สร้าง session (CORE-4i-b: `{ ok } | { error }` จาก helper กลาง — `paymentSessionResult`):
 * 409 + code ของ guard → (d) poll GB-8; 400 `GB_PAYMENT_CLOSED` → closed (GB-22); 401 → login; `failed` (non-2xx อื่นทุกแบบ/network) → (d2) ตัดสินจากสถานะ GB-8
 */
export function sessionCreateOutcome(result: OrderPaySessionResult): SessionCreateOutcome {
  if ("ok" in result) return "created"
  if (result.error === PAYMENT_ALREADY_COMPLETED) return "already-paid"
  if (result.error === GB_PAYMENT_CLOSED) return "closed"
  if (result.error === "unauthorized") return "unauthorized"
  return "check-status"
}

export type StripeReturn = "poll" | "failed" | null

/**
 * กฎข้อ 9 (d3): query ที่ Stripe แนบมาเมื่อ redirect กลับหน้า pay (3DS/พร้อมเพย์) — ต้องมีทั้ง `payment_intent` และ `redirect_status`
 * `succeeded`/`processing` → poll GB-8 ทันที (webhook อาจยังไม่มา); `failed`/`requires_payment_method` → error + ฟอร์ม; อื่น ๆ → null (ตามข้อ b)
 */
export function stripeReturn(query: Record<string, string | string[] | undefined>): StripeReturn {
  const { payment_intent: pi, redirect_status: status } = query
  if (typeof pi !== "string" || !pi || typeof status !== "string") return null
  if (status === "succeeded" || status === "processing") return "poll"
  if (status === "failed" || status === "requires_payment_method") return "failed"
  return null
}
