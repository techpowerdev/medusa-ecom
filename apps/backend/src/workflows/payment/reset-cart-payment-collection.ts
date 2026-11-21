import { Modules } from "@medusajs/framework/utils"
import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  dismissRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { isFullyRefundedCollection, type RefundablePayment } from "../../lib/refunded-payments"

export type ResetCartPaymentCollectionInput = { cart_id: string; payment_collection_id: string }

// key เดียวกับ processPaymentWorkflow/completeCartWorkflow และ guardPaidStripeSession (ADR-015) — timeout เท่ากัน
const LOCK_TIMEOUT_SECONDS = 30
const LOCK_TTL_SECONDS = 30

export const RESET_COLLECTION_FIELDS = [
  "id",
  "cart.id",
  "order.id",
  "payments.id",
  "payments.canceled_at",
  "payments.captures.raw_amount",
  "payments.refunds.raw_amount",
]

/**
 * PAY-9 (spec 06 กฎข้อ 11, ADR-025): ถอด link cart ↔ payment collection ที่ถูกคืนเงินครบและยังไม่มี order
 * เพื่อให้ cart สร้าง collection ใหม่ด้วย route ของ Medusa — collection เดิมคงอยู่เป็นหลักฐาน (ไม่ลบ ไม่ refund ไม่เรียก provider)
 * ตรวจซ้ำภายใต้ lock `cart_id`; compensation ของ `dismissRemoteLinkStep` สร้าง link คืน
 * `reset` = collection นี้ถูกคืนครบและไม่ผูก order (รวมกรณี request ก่อนหน้าถอด link ไปแล้ว — idempotent)
 */
export const resetCartPaymentCollectionWorkflow = createWorkflow(
  "reset-cart-payment-collection",
  function (input: ResetCartPaymentCollectionInput) {
    const lockOwnerId = transform({ input }, (_, { context }) => `pay9-reset:${context.transactionId}`)
    acquireLockStep({ key: input.cart_id, ownerId: lockOwnerId, timeout: LOCK_TIMEOUT_SECONDS, ttl: LOCK_TTL_SECONDS })

    const { data: collections } = useQueryGraphStep({
      entity: "payment_collection",
      fields: RESET_COLLECTION_FIELDS,
      filters: { id: input.payment_collection_id },
    })
    const state = transform({ collections, input }, ({ collections, input }) => {
      const collection = collections[0]
      const reset =
        !!collection &&
        !collection.order?.id &&
        isFullyRefundedCollection(collection.payments as RefundablePayment[])
      return { reset, linked: reset && collection.cart?.id === input.cart_id }
    })

    when("dismiss-refunded-cart-payment-collection", { state }, ({ state }) => state.linked).then(() => {
      dismissRemoteLinkStep({
        [Modules.CART]: { cart_id: input.cart_id },
        [Modules.PAYMENT]: { payment_collection_id: input.payment_collection_id },
      })
    })

    releaseLockStep({ key: input.cart_id, ownerId: lockOwnerId })
    return new WorkflowResponse(transform({ state }, ({ state }) => ({ reset: state.reset })))
  }
)
