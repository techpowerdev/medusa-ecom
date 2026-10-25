import { MathBN } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"

// FS-2 (spec 03 กฎข้อ 10): ตัดสินว่า order ถูก refund เต็มจำนวนหรือไม่ — pure
// เกณฑ์เดียวไม่ว่า refund มาจาก cancel, return หรือคืนด้วยมือ (owner 2026-10-25) — ดูยอดรวมสะสมทุกครั้ง
// ใช้ raw_amount + MathBN แบบเดียวกับ validatePaymentsRefundStep ของ Medusa (ไม่ใช้ float)

// query.graph คืน raw_amount เป็น JSON ({ value, precision }) — MathBN แปลงได้โดยตรง
type MoneyRow = { raw_amount?: BigNumberInput | Record<string, unknown> | null } | null

export type OrderPaymentsLike = {
  payment_collections?:
    | ({ payments?: ({ captures?: MoneyRow[] | null; refunds?: MoneyRow[] | null } | null)[] | null } | null)[]
    | null
}

/** refund เต็มจำนวน = ยอด refund รวม >= ยอด capture รวม ของทุก payment ของ order และมีการ capture แล้ว (> 0) */
export function isOrderFullyRefunded(order: OrderPaymentsLike): boolean {
  const payments = (order.payment_collections ?? []).flatMap((pc) => pc?.payments ?? [])
  const rows = (pick: (p: NonNullable<(typeof payments)[number]>) => MoneyRow[] | null | undefined) =>
    payments.flatMap((p) => (p ? pick(p) ?? [] : [])).map((row) => (row?.raw_amount ?? 0) as BigNumberInput)

  const captured = MathBN.sum(0, ...rows((p) => p.captures))
  const refunded = MathBN.sum(0, ...rows((p) => p.refunds))
  return MathBN.gt(captured, 0) && MathBN.gte(refunded, captured)
}
