import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logCheckoutPhase } from "../../lib/checkout-phase-timing"
import { type CartLike, assertCompletionCombinable, assertNoGroupBuyCode } from "./promotion-exclusivity"
import {
  type FlashSaleCartLike,
  type FlashSaleReservationRef,
  releaseFlashSaleForCart,
  reserveFlashSaleForCart,
} from "./flash-sale-reservation"
import { STEP_AFTER_VALIDATE_FAILED, warnIfCompletionFailedAfterPayment } from "./paid-completion-failure"

type ValidateCompensation = { reservation?: FlashSaleReservationRef; cart_id: string; payment_session_ids: string[] }

const paymentSessionIds = (cart: { payment_collection?: { payment_sessions?: ({ id: string } | null)[] | null } | null }) =>
  (cart.payment_collection?.payment_sessions ?? []).flatMap((session) => (session ? [session.id] : []))

// handler รวมของ completeCartWorkflow.hooks.validate (spec 03 กฎข้อ 8 — hook หนึ่งตัวมี handler ได้ตัวเดียว)
// ลำดับ: check ที่อ่านอย่างเดียวก่อน check ที่เขียนข้อมูล; check ใหม่ในอนาคตเพิ่มในไฟล์นี้
completeCartWorkflow.hooks.validate<ValidateCompensation | undefined>(
  async ({ cart }, { container }) => {
    // OPS-20a (spec 07 AC-31): เวลาต้น/ท้าย handler รวม = ท้าย (b), ช่วง (c), ต้น (d) — debug เท่านั้น
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const startedAt = Date.now()
    let outcome = "ok"
    try {
      // retry complete ของ cart ที่ complete แล้ว → คืน order เดิม ไม่ตรวจ/จองซ้ำ (กฎข้อ 11)
      if (cart.completed_at) {
        outcome = "already_completed"
        return
      }

      // 1. PROMO-1: exclusivity ด่านสำรอง (กฎข้อ 6e) — อ่านอย่างเดียว
      await assertCompletionCombinable(container, cart as CartLike)
      // 1b. GB-3 (owner 2026-10-26): cart ที่มี GB-* complete ไม่ได้ — หลัง 1 เพื่อให้ GB-* + code อื่น ยังได้ PROMOTION_NOT_COMBINABLE
      assertNoGroupBuyCode(cart as CartLike)

      // 2. FS-3: per-customer limit + total cap ภายใต้ lock, transaction เดียว
      const reservation = await reserveFlashSaleForCart(container, cart as FlashSaleCartLike)

      return new StepResponse(undefined, { reservation, cart_id: cart.id, payment_session_ids: paymentSessionIds(cart) })
    } catch (e) {
      outcome = (e as { code?: string })?.code || "ERROR"
      // OPS-32: hook ล้ม → compensation ของ hook ไม่รัน จึง warn ที่นี่ (ก่อน compensatePaymentIfNeededStep ของ Medusa)
      await warnIfCompletionFailedAfterPayment(container, { cart_id: cart.id, payment_session_ids: paymentSessionIds(cart), code: outcome })
      throw e
    } finally {
      logCheckoutPhase(logger, { phase: "hook", cart_id: cart.id, started_at: startedAt, ended_at: Date.now(), outcome })
    }
  },
  // step หลัง hook ล้ม → OPS-32 warn ถ้าจ่ายแล้ว (ก่อน compensation ของ Medusa ที่ refund) + FS-3 คืน usage + units_sold และลบ reservation
  async (data: ValidateCompensation | undefined, { container }) => {
    if (!data) {
      return
    }
    await warnIfCompletionFailedAfterPayment(container, {
      cart_id: data.cart_id,
      payment_session_ids: data.payment_session_ids,
      code: STEP_AFTER_VALIDATE_FAILED,
    })
    if (data.reservation) {
      await releaseFlashSaleForCart(container, data.reservation)
    }
  }
)
