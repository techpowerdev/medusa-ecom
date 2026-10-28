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
