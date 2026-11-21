// hotfix PAY-9 (spec 06 AC-22c, ADR-025): Medusa 2.22.1 คืนเงินใน compensation ของ completeCartWorkflow ที่ webhook สั่ง (async)
// ลำดับ: refundPaymentsWorkflow (Stripe มี refund ทันที) → บันทึก refund → createPaymentSessionsWorkflow ด้วย `data` เดิม
// ซึ่งสร้างแถว session `pending` (PI เดิมที่จบแล้ว) ก่อนเรียก Stripe แล้วลบทิ้งเมื่อ Stripe ปฏิเสธ
// → "Stripe มี refund" ยังไม่ใช่ "Medusa คืนเงินเสร็จ" — หน้า checkout ที่ render ช่วงนั้นเห็น session ชั่วคราว
// เงื่อนไขนี้ตรงกับที่ backend ใช้ตัดสิน reset (`isResettableCollection`: คืนครบ + ไม่มี session ที่รอชำระ)

export type MedusaPaymentAmounts = {
  captures?: { amount: number }[] | null
  refunds?: { amount: number }[] | null
}

/** session ที่มี payment แล้ว — สถานะอื่น (pending, requires_more, ...) = ยังรอชำระ */
const PAID_SESSION_STATUSES = ["authorized", "captured"]

/**
 * payment ของ session แรก capture แล้วถูกคืนเต็มจำนวนในครั้งเดียว (แบบ compensatePaymentIfNeededStep)
 * และ collection ของ cart ไม่มี session ที่รอชำระ = compensation ของ Medusa จบแล้ว
 */
export function medusaRefundSettled(
  payment: MedusaPaymentAmounts | undefined,
  sessions: { status: string }[]
): boolean {
  const captures = payment?.captures ?? []
  const refunds = payment?.refunds ?? []
  return (
    captures.length === 1 &&
    refunds.length === 1 &&
    refunds[0].amount === captures[0].amount &&
    sessions.every((s) => PAID_SESSION_STATUSES.includes(s.status))
  )
}
