import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { acquireLockStep, refundPaymentsWorkflow, releaseLockStep } from "@medusajs/medusa/core-flows"
import { refundBalance, refundResult, type RefundResult } from "../../modules/group_buy/utils/membership-payment"
import { LOCK_TIMEOUT, LOCK_TTL } from "./join-group"

export const CANCELLED_MEMBERSHIP_REFUND_NOTE = "Refunded: group buy membership cancelled"

export type RefundCancelledMembershipInput = { payment_id: string }

// ยอดคงเหลือ captured − refunded ของ payment (refund ที่ล้มถูก soft-delete โดย Payment module จึงไม่ถูกนับ)
export async function paymentRefundBalance(container: MedusaContainer, paymentId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["id", "captures.raw_amount", "refunds.raw_amount"],
    filters: { id: paymentId },
  })
  const payment = data[0] as { captures?: { raw_amount: unknown }[]; refunds?: { raw_amount: unknown }[] } | undefined
  return refundBalance(payment?.captures, payment?.refunds)
}

// อ่านใต้ lock ของ payment — event ซ้ำ/พร้อมกันตัวหลังเห็น refund ของตัวแรกแล้ว → noop
export const groupBuyRefundBalanceStep = createStep(
  "group-buy-refund-balance",
  async (input: RefundCancelledMembershipInput, { container }) => {
    const balance = await paymentRefundBalance(container, input.payment_id)
    const refund = MathBN.gt(balance, 0)
    if (!refund) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(`group-buy-refund: payment_id=${input.payment_id} already fully refunded — noop`)
    }
    return new StepResponse({ refund, amount: balance.toString() })
  }
)

// GB-21 กฎข้อ 44 (ADR-024 c): คืนยอดคงเหลือด้วย refundPaymentsWorkflow ของ Medusa (ไม่สร้าง credit line จึงไม่ชน
// throwIfOrderIsCancelled ของ draft order ที่ยกเลิก) — ไม่ใช้ refundPaymentWorkflow และไม่เรียก Stripe ตรง
export const refundCancelledMembershipPaymentWorkflow = createWorkflow(
  "refund-cancelled-group-buy-membership-payment",
  function (input: RefundCancelledMembershipInput) {
    const key = transform({ input }, ({ input }) => `group_buy:refund:${input.payment_id}`)
    acquireLockStep({ key, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })
    const balance = groupBuyRefundBalanceStep(input)
    when("refund-cancelled-group-buy-payment", { balance }, ({ balance }) => balance.refund).then(() => {
      const refunds = transform({ input, balance }, ({ input, balance }) => [
        { payment_id: input.payment_id, amount: balance.amount, note: CANCELLED_MEMBERSHIP_REFUND_NOTE },
      ])
      refundPaymentsWorkflow.runAsStep({ input: refunds })
    })
    releaseLockStep({ key })
    return new WorkflowResponse(balance)
  }
)

// attempt=false (อ่านสถานะ membership ใหม่ไม่ได้) → ไม่คืนเงิน รายงานผลจากยอดคงเหลืออย่างเดียว
// ผลตัดสินจากการอ่าน payment.refunds ใหม่หลัง workflow จบหรือ throw — ไม่ใช่จาก exception (refundPaymentsStep กลืน error
// ของ provider เอง และ step หลัง refund อาจ throw ทั้งที่คืนเงินแล้ว); ไม่ throw ออก — subscriber ต้องส่ง alert ต่อเสมอ
export async function refundCancelledMembershipPayment(
  container: MedusaContainer,
  paymentId: string,
  attempt = true
): Promise<{ refund_result: RefundResult; error?: string }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const message = (e: unknown) => (e as { message?: string } | null)?.message ?? String(e)
  let error: string | undefined
  if (attempt) {
    try {
      const { errors } = await refundCancelledMembershipPaymentWorkflow(container).run({
        input: { payment_id: paymentId },
        throwOnError: false,
      })
      error = errors.map((e) => message(e.error)).join("; ") || undefined
    } catch (e) {
      error = message(e)
    }
  }
  let result: RefundResult = "refund_failed"
  try {
    result = refundResult(await paymentRefundBalance(container, paymentId))
  } catch (e) {
    error = [error, `re-reading refunds failed: ${message(e)}`].filter(Boolean).join("; ")
  }
  if (error) {
    logger.warn(`group-buy-refund: payment_id=${paymentId} refund_result=${result} — workflow error: ${error}`)
  }
  return { refund_result: result, ...(error ? { error } : {}) }
}
