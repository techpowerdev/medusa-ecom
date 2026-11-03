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
