import type { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"

export type MembershipStatus = "joined" | "awaiting_payment" | "paid" | "cancelled"

// กฎข้อ 20 (AC-37): ส่วนลด % ให้ total ทศนิยมไม่จำกัด แต่ Stripe รับหน่วยสตางค์ — ปัด 2 ตำแหน่ง
// (MathBN.convert ใช้ BigNumber.js ROUND_HALF_UP ค่าเริ่มต้น; unit test ตรึงพฤติกรรม half-up ไว้)
const THB_DECIMALS = 2
export const memberPaymentAmount = (total: BigNumberInput) => MathBN.convert(total, THB_DECIMALS)

// payment.captured: collection ที่ capture ครบ (`completed`) เท่านั้นจึงแปลง draft order — paid แล้ว = no-op (idempotent);
// membership ที่ไม่ได้รอชำระ (cancelled/joined) แต่มีเงินเข้า = orphan ให้ ops ตรวจ/refund เอง
export function paymentCapturedAction(
  status: MembershipStatus,
  collectionStatuses: string[]
): "mark_paid" | "noop" | "orphan" {
  if (status === "paid") {
    return "noop"
  }
  if (status !== "awaiting_payment") {
    return "orphan"
  }
  return collectionStatuses.includes("completed") ? "mark_paid" : "noop"
}

// GB-10 กฎข้อ 26: ops แปลง draft order เองหลังเงินเข้า (order.placed) → paid เฉพาะ membership ที่ยังรอชำระ,
// order แปลงแล้ว และ collection capture ครบ — สถานะอื่น (รวม paid จากเส้นทางปกติของ GB-5) = no-op
export const convertedOrderAction = (
  status: MembershipStatus,
  isDraftOrder: boolean,
  collectionStatuses: string[]
): "mark_paid" | "noop" =>
  status === "awaiting_payment" && !isDraftOrder && collectionStatuses.includes("completed") ? "mark_paid" : "noop"

// หมดเวลาชำระเงิน: ไม่ยกเลิก order ที่มีการ authorize/capture แล้ว (cancelOrderWorkflow จะ refund เงินที่ capture แล้ว)
const UNPAID = new Set(["not_paid", "awaiting", "canceled", "failed"])

export const shouldExpireMembershipPayment = (
  status: MembershipStatus,
  payDeadlineAt: string | Date | null | undefined,
  now: Date,
  collectionStatuses: string[]
) =>
  status === "awaiting_payment" &&
  !!payDeadlineAt &&
  new Date(payDeadlineAt).getTime() <= now.getTime() &&
  collectionStatuses.every((s) => UNPAID.has(s))

// GB-20 กฎข้อ 42 (ADR-024 a): สร้าง payment session ได้เฉพาะ membership ที่รอชำระ ก่อน pay_deadline_at และ collection ยังไม่ถูกยกเลิก
export const isGroupBuyPaymentOpen = (
  status: MembershipStatus,
  payDeadlineAt: string | Date | null | undefined,
  now: Date,
  collectionStatus: string
) =>
  status === "awaiting_payment" &&
  !!payDeadlineAt &&
  now.getTime() < new Date(payDeadlineAt).getTime() &&
  collectionStatus !== "canceled"

// กฎข้อ 25 (GB-9): alert เงินค้าง GROUP_BUY_PAID_WITHOUT_ORDER — `convert_failed` หรือ `membership_<สถานะตอน capture>`
export type PaidWithoutOrderReason = "convert_failed" | `membership_${MembershipStatus}`

// ตัดสินจากสถานะที่อ่านใหม่หลัง workflow จบ: ส่งเฉพาะเมื่อยังเป็นเงินค้างจริง (กัน ops refund order ที่แปลงสำเร็จแล้ว)
export function shouldSendPaidWithoutOrderAlert(
  reason: PaidWithoutOrderReason,
  current: { membership_status: MembershipStatus; is_draft_order: boolean }
): boolean {
  if (reason === "convert_failed") {
    return current.is_draft_order && current.membership_status !== "paid"
  }
  return reason === `membership_${current.membership_status}`
}

// membership เดียวเจอได้ทั้งสองเหตุ → key ต่อ membership + เหตุ
export const paidWithoutOrderAlertKey = (membershipId: string, reason: PaidWithoutOrderReason) =>
  `${membershipId}:${reason}`

// GB-21 กฎข้อ 44 (ADR-024 c): ยอดที่ยังคืนได้ = captured − refunded (MathBN จาก raw_* — ห้าม float)
type RawAmountRow = { raw_amount?: unknown; amount?: unknown } | null
const sumRaw = (rows: RawAmountRow[] | null | undefined) =>
  (rows ?? []).reduce(
    (total, row) => MathBN.add(total, MathBN.convert((row?.raw_amount ?? row?.amount ?? 0) as BigNumberInput)),
    MathBN.convert(0)
  )

export const refundBalance = (captures: RawAmountRow[] | null | undefined, refunds: RawAmountRow[] | null | undefined) =>
  MathBN.sub(sumRaw(captures), sumRaw(refunds))

// ผลตัดสินจากยอดคงเหลือที่อ่านใหม่หลังคืนเงิน (ไม่ใช่จาก exception)
export type RefundResult = "refunded" | "refund_failed"
export const refundResult = (balance: BigNumberInput): RefundResult =>
  MathBN.lte(balance, 0) ? "refunded" : "refund_failed"

// GB-20b กฎข้อ 50 (ADR-024 ภาคผนวก 2026-11-21): ผลตรวจ session ที่ provider ด้วย paymentModule.authorizePaymentSession
// payment = ได้ payment (existing = session มี payment อยู่ก่อนรอบนี้ — การหยิบซ้ำเพื่อ capture), pending = ได้ null (pending_authorization),
// not_allowed = throw NOT_ALLOWED (status = data.status ของ PI ที่ Medusa บันทึกไว้ก่อน throw), error = error อื่น
export type PaymentSessionCheck =
  | { outcome: "payment"; existing: boolean }
  | { outcome: "pending" }
  | { outcome: "not_allowed"; status?: string }
  | { outcome: "error" }

export type MembershipPaymentCheckDecision = "paid" | "unpaid" | "retry" | "give_up" | "skip"

// owner ยืนยัน 2026-11-21: ลองตรวจซ้ำ/หยิบ capture ซ้ำได้ไม่เกิน 15 นาทีนับจาก pay_deadline_at
export const GROUP_BUY_PAYMENT_CHECK_GIVE_UP_MINUTES = 15

// paid ชนะทุกผล — การจ่ายที่เจอครั้งแรกนับเป็น paid เสมอแม้เลย 15 นาที (worker ดับนาน — review #440 nit 1);
// เพดานใช้กับการหยิบ payment เดิมซ้ำ (เลยแล้ว = skip: ไม่ capture ไม่ expire — พึ่ง webhook / alert convert_failed กฎข้อ 25)
// และกับผลที่ตรวจไม่ได้ (retry → give_up); ทุก session NOT_ALLOWED ที่ไม่ใช่ processing (หรือไม่มี session) = unpaid
export function membershipPaymentCheckDecision(
  results: PaymentSessionCheck[],
  payDeadlineAt: string | Date,
  now: Date
): MembershipPaymentCheckDecision {
  const expired =
    now.getTime() - new Date(payDeadlineAt).getTime() >= GROUP_BUY_PAYMENT_CHECK_GIVE_UP_MINUTES * 60_000
  const payments = results.filter((r) => r.outcome === "payment")
  if (payments.some((r) => !r.existing)) {
    return "paid"
  }
  if (payments.length) {
    return expired ? "skip" : "paid"
  }
  if (results.every((r) => r.outcome === "not_allowed" && r.status !== "processing")) {
    return "unpaid"
  }
  return expired ? "give_up" : "retry"
}

// GB-32 กฎข้อ 58 (a) (Q26 = ก owner 2026-11-23): job หมดเวลาชำระตรวจกับ provider ได้ไม่เกิน 4 × BATCH (50) รายต่อรอบ
// นับทุกผล (paid/unpaid/retry/skip/give_up และที่ล้ม) — provider ล่มทุกรายถูกยิงไม่เกิน 200 ครั้ง/นาที
export const MAX_PAYMENT_CHECKS_PER_TICK = 200
