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

export type CollectionSession = { id?: string; payment?: { id?: string } | null } | null

/**
 * review #445 (เงิน): session ที่ยังไม่ถูกลบและยังไม่มี payment (provider ใดก็ได้) อาจเป็นการจ่ายที่ webhook ยังไม่มา —
 * ถ้า reset จะถอด link จนเงินเข้าแบบไม่มี order และไม่มี alert ของ ADR-015 → ห้าม reset
 * (Medusa 2.22.1: compensation ลบ session เดิมก่อน recreate จึงไม่กระทบกรณี O-2 ปกติ)
 */
export function hasUnpaidSession(sessions: CollectionSession[] | null | undefined): boolean {
  return (sessions ?? []).some((s) => !!s && !s.payment?.id)
}

// PAY-9: field ของ payment_collection ที่ middleware (pre-check) และ workflow (ตรวจซ้ำใต้ lock) อ่าน
export const RESET_COLLECTION_FIELDS = [
  "id",
  "cart.id",
  "order.id",
  "payments.id",
  "payments.canceled_at",
  "payments.captures.raw_amount",
  "payments.refunds.raw_amount",
  "payment_sessions.id",
  "payment_sessions.payment.id",
]

/** คืนเงินครบ ไม่ผูก order และไม่มี session ที่ยังรอ payment (review #445) — ใช้ทั้ง pre-check ใน middleware และตรวจซ้ำใต้ lock */
export const isResettableCollection = (collection?: {
  order?: { id?: string } | null
  payments?: unknown
  payment_sessions?: unknown
} | null): boolean =>
  !!collection &&
  !collection.order?.id &&
  isFullyRefundedCollection(collection.payments as RefundablePayment[]) &&
  !hasUnpaidSession(collection.payment_sessions as CollectionSession[])
