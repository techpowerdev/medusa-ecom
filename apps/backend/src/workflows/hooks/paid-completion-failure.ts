import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// OPS-32 (spec 07 AC-47 a): completeCartWorkflow ล้มหลัง capture → Medusa 2.22.1 compensatePaymentIfNeededStep คืนเงินเอง
// แล้วสร้าง payment session ใหม่ด้วย `data` เดิมซึ่งล้ม → log "Error was thrown trying to refund payment … [object Object]"
// ทั้งที่คืนเงินสำเร็จ (ADR-025 บริบท) — warn บรรทัดนี้ออกก่อน compensation ของ Medusa เพื่อบอก ops ว่าต้องตรวจอะไร
export const CART_COMPLETION_FAILED_AFTER_PAYMENT = "CART_COMPLETION_FAILED_AFTER_PAYMENT"
// step หลัง hook validate ล้ม: compensation ของ hook ไม่รู้ error ต้นเหตุ (ดู log error ของ workflow)
export const STEP_AFTER_VALIDATE_FAILED = "STEP_AFTER_VALIDATE_FAILED"
const HINT =
  "Medusa refunds automatically; a following 'Error was thrown trying to refund payment' line comes from re-creating the payment session — verify refunds via GET /admin/payments/:id"

type SessionWithPayment = { id: string; payment?: { id: string; captured_at?: Date | string | null } | null }

/** warn เมื่อ session ใดของ cart มี payment ที่ capture แล้ว — ไม่โยน error (ห้ามบัง error เดิมของ complete) */
export async function warnIfCompletionFailedAfterPayment(
  container: MedusaContainer,
  input: { cart_id: string; payment_session_ids: string[]; code: string }
): Promise<void> {
  if (!input.payment_session_ids.length) {
    return
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "payment_session",
      fields: ["id", "payment.id", "payment.captured_at"],
      filters: { id: input.payment_session_ids },
    })
    const paid = (data as SessionWithPayment[]).find((session) => session.payment?.captured_at)
    if (!paid) {
      return
    }
    logger.warn(
      `${CART_COMPLETION_FAILED_AFTER_PAYMENT} cart_id=${input.cart_id} payment_session_id=${paid.id} ` +
        `payment_id=${paid.payment!.id} code=${input.code} — ${HINT}`
    )
  } catch (error) {
    logger.warn(
      `complete-cart-validate: could not check captured payment of cart_id=${input.cart_id}: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
  }
}
