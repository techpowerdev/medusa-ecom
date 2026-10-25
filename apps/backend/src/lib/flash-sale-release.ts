// FS-2 (spec 03 กฎข้อ 10): ตัดสินว่า order ถูก refund เต็มจำนวนหรือไม่ — pure

type AmountLike = number | string | { numeric?: number } | null | undefined

type MoneyRow = { amount?: AmountLike } | null

export type OrderPaymentsLike = {
  payment_collections?:
    | ({ payments?: ({ captures?: MoneyRow[] | null; refunds?: MoneyRow[] | null } | null)[] | null } | null)[]
    | null
}

const toNumber = (a: AmountLike) =>
  typeof a === "object" && a !== null ? Number(a.numeric ?? 0) : Number(a ?? 0)

const sum = (rows: MoneyRow[] | null | undefined) =>
  (rows ?? []).reduce((total, row) => total + toNumber(row?.amount), 0)

/** refund เต็มจำนวน = ยอด refund รวม >= ยอด capture รวม ของทุก payment ของ order และมีการ capture แล้ว (> 0) */
export function isOrderFullyRefunded(order: OrderPaymentsLike): boolean {
  const payments = (order.payment_collections ?? []).flatMap((pc) => pc?.payments ?? [])
  const captured = payments.reduce((total, p) => total + sum(p?.captures), 0)
  const refunded = payments.reduce((total, p) => total + sum(p?.refunds), 0)
  return captured > 0 && refunded >= captured
}
