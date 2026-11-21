import { BigNumber, MathBN } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"

type AmountRow = { raw_amount?: BigNumberInput | null } | null
export type RefundablePayment = {
  canceled_at?: Date | string | null
  captures?: AmountRow[] | null
  refunds?: AmountRow[] | null
} | null

const sum = (rows: AmountRow[] | null | undefined) =>
  (rows ?? []).reduce((total, row) => MathBN.add(total, new BigNumber(row?.raw_amount ?? 0)), MathBN.convert(0))

/**
 * PAY-9 (spec 06 กฎข้อ 11, ADR-025): payment ทุกตัวที่ไม่ถูกยกเลิก capture แล้วและถูกคืนครบ (refunded ≥ captured ด้วย MathBN)
 * และมีอย่างน้อยหนึ่งตัว — payment ที่ยังไม่ capture หรือคืนไม่ครบ = ยังมีเงินของลูกค้าอยู่ใน collection นี้
 */
export function isFullyRefundedCollection(payments: RefundablePayment[] | null | undefined): boolean {
  const active = (payments ?? []).filter((p) => !p?.canceled_at)
  return (
    active.length > 0 &&
    active.every((p) => {
      const captured = sum(p?.captures)
      return MathBN.gt(captured, 0) && MathBN.gte(sum(p?.refunds), captured)
    })
  )
}
