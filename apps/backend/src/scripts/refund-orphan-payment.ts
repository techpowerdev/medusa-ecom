import { refundPaymentsWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { BigNumber, ContainerRegistrationKeys, MathBN, MedusaError } from "@medusajs/framework/utils"

// PAY-6b2 (ADR-015 ภาคผนวก 2, owner 2026-10-26): refund payment ที่ captured แล้วแต่ไม่มี order (cart complete ไม่ได้)
// ผ่าน `refundPaymentsWorkflow` ของ Medusa (refund ที่ provider + บันทึก refund ใน payment module) — ไม่เรียก Stripe ตรง
// `refundPaymentWorkflow` (ของ admin route) ใช้ไม่ได้เพราะต้องมี order ผูกกับ payment collection
// ใช้: `npx medusa exec ./src/scripts/refund-orphan-payment.ts <payment_id>` ตาม runbook ใน docs/ops/production.md

type RawAmount = { raw_amount?: unknown; amount?: unknown }

const sum = (rows: RawAmount[] | null | undefined) =>
  (rows ?? []).reduce((total, row) => MathBN.add(total, new BigNumber((row.raw_amount ?? row.amount) as any)), MathBN.convert(0))

async function refundable(container: MedusaContainer, paymentId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment",
    fields: ["id", "captures.raw_amount", "refunds.raw_amount", "payment_collection.order.id"],
    filters: { id: paymentId },
  })
  const payment = data[0]
  if (!payment) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `ไม่พบ payment ${paymentId}`)
  }
  return {
    orderId: (payment.payment_collection as { order?: { id: string } | null } | null)?.order?.id,
    captured: sum(payment.captures as RawAmount[]),
    remaining: MathBN.sub(sum(payment.captures as RawAmount[]), sum(payment.refunds as RawAmount[])),
  }
}

/** refund ส่วนที่ยังไม่ refund ของ payment ที่ captured และไม่มี order — รันซ้ำได้ (ข้ามถ้า refund ครบแล้ว) */
export async function refundOrphanPayment(
  container: MedusaContainer,
  paymentId: string
): Promise<{ status: "refunded" | "already-refunded" | "refunded-elsewhere"; amount: string }> {
  const before = await refundable(container, paymentId)
  if (before.orderId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `payment ${paymentId} ผูกกับ order ${before.orderId} แล้ว — ใช้ refund ใน admin ของ order แทน script นี้`
    )
  }
  if (MathBN.lte(before.captured, 0)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `payment ${paymentId} ยังไม่ถูก captured — ไม่มีเงินให้ refund`)
  }
  if (MathBN.lte(before.remaining, 0)) {
    return { status: "already-refunded", amount: "0" }
  }

  // ไม่ lock: compensation ของ completeCartWorkflow (compensatePaymentIfNeededStep) อาจ refund payment นี้พร้อมกัน
  // validatePaymentsRefundStep อ่านยอดก่อน refund จึงไม่กันกรณีพร้อมกันจริง — สิ่งที่กัน refund เกินคือ Stripe ปฏิเสธ refund เกินยอดของ charge
  // ฝั่งที่มาทีหลังจึงล้ม แล้ว script รายงานตามจริงว่าใครเป็นผู้ refund (refunded / refunded-elsewhere)
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .warn(
      `refund-orphan-payment: กำลัง refund ${before.remaining.toString()} ของ payment ${paymentId} — อาจชนกับ refund อัตโนมัติ ` +
        `(Refunded due to cart completion failure) ถ้าเกิดขึ้น script จะรายงานผลตาม refunds จริง`
    )
  let refundedByScript = false
  try {
    const { result } = await refundPaymentsWorkflow(container).run({
      input: [{ payment_id: paymentId, amount: before.remaining, note: "ADR-015: payment ที่ไม่มี order" }],
    })
    // refundPaymentsStep ของ Medusa log error แทนการ throw เมื่อ provider ล้ม → payment ที่ refund สำเร็จเท่านั้นอยู่ใน result
    refundedByScript = (result ?? []).some((payment) => payment.id === paymentId)
  } catch (error) {
    // เช่น validatePaymentsRefundStep เห็น refund ของอีกฝั่งแล้ว → ตัดสินจาก refunds จริงด้านล่าง
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`refund-orphan-payment: refundPaymentsWorkflow ล้ม: ${error instanceof Error ? error.message : String(error)}`)
  }

  const after = await refundable(container, paymentId)
  if (MathBN.gt(after.remaining, 0)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `refund payment ${paymentId} ไม่สำเร็จ (ยังเหลือ ${after.remaining.toString()}) — ดู log ของ provider และ refunds แล้วรันใหม่`
    )
  }
  if (!refundedByScript) {
    return { status: "refunded-elsewhere", amount: "0" }
  }
  return { status: "refunded", amount: before.remaining.toString() }
}

export default async function refundOrphanPaymentScript({ container, args }: ExecArgs) {
  const paymentId = args?.[0]?.trim()
  if (!paymentId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "ต้องระบุ payment id: medusa exec ./src/scripts/refund-orphan-payment.ts <payment_id>")
  }
  const result = await refundOrphanPayment(container, paymentId)
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(
      result.status === "refunded"
        ? `refund-orphan-payment: refund สำเร็จ payment ${paymentId} amount=${result.amount}`
        : result.status === "refunded-elsewhere"
          ? `refund-orphan-payment: payment ${paymentId} ถูก refund ครบโดยอีกฝั่งระหว่างรัน (เช่น compensation ของ completeCartWorkflow) — script ไม่ได้ refund`
          : `refund-orphan-payment: payment ${paymentId} refund แล้ว (ครบยอดที่ capture) — ไม่ refund ซ้ำ`
    )
}
