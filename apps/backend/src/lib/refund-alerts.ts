import { BigNumber, MathBN } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"

// PAY-20 (spec 06 กฎข้อ 22b, ADR-029 ก): จัดประเภทแถว refund ของ Payment module → code ของ alert (pure)
export const REFUND_FAILED = "REFUND_FAILED"
export const REFUND_STUCK = "REFUND_STUCK"
export type RefundAlertCode = typeof REFUND_FAILED | typeof REFUND_STUCK

export const REFUND_STUCK_AFTER_MS = 60 * 60_000

type AmountRow = { raw_amount?: BigNumberInput | null; deleted_at?: Date | string | null } | null

export type ScannedRefund = {
  status: string
  deleted_at?: Date | string | null
  updated_at: Date | string
}

export type ScannedPayment = { captures?: AmountRow[] | null; refunds?: AmountRow[] | null } | null

const sum = (rows: AmountRow[] | null | undefined) =>
  (rows ?? [])
    .filter((row) => !row?.deleted_at)
    .reduce((total, row) => MathBN.add(total, new BigNumber(row?.raw_amount ?? 0)), MathBN.convert(0))

/**
 * failed (รวมแถวที่ soft-delete) และ payment ยังเหลือ captured − refunded > 0 (นับเฉพาะ refund ที่ไม่ถูกลบ) → REFUND_FAILED;
 * เหลือ 0 = คืนสำเร็จภายหลัง → null (เดาจากยอด — ข้อจำกัดดู runbook "คืนเงินล้ม/ค้าง (ADR-029)");
 * pending ที่ไม่ถูกลบและไม่ขยับมา ≥ 60 นาที → REFUND_STUCK
 */
export function classifyRefund(refund: ScannedRefund, payment: ScannedPayment, now: Date): RefundAlertCode | null {
  if (refund.status === "failed") {
    const remaining = MathBN.sub(sum(payment?.captures), sum(payment?.refunds))
    return MathBN.gt(remaining, 0) ? REFUND_FAILED : null
  }
  if (refund.status === "pending" && !refund.deleted_at) {
    return now.getTime() - new Date(refund.updated_at).getTime() >= REFUND_STUCK_AFTER_MS ? REFUND_STUCK : null
  }
  return null
}
