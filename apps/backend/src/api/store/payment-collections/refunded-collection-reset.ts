import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { RESET_COLLECTION_FIELDS, isResettableCollection } from "../../../lib/refunded-payments"
import { resetCartPaymentCollectionWorkflow } from "../../../workflows/payment/reset-cart-payment-collection"
import { PAYMENT_COLLECTION_RESET } from "./errors"

const collectionReset = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "This payment collection was refunded and detached from the cart. Create a new payment collection for the cart.",
    PAYMENT_COLLECTION_RESET
  )

// PAY-9 (spec 06 กฎข้อ 11, ADR-025 — O-2): payment ที่ compensatePaymentIfNeededStep คืนเงินแล้วยังค้างใน collection ของ cart
// → ถ้าจ่ายใหม่ใน collection เดิม order จะมี payment ที่คืนแล้วปนอยู่ (payment_status = refunded)
// ลำดับ: ownership (ADR-013) → GB guard (ADR-024) → middleware นี้ → guardPaidStripeSession (ADR-015 — session ที่คืนแล้วทำให้ตอบ
// PAYMENT_ALREADY_COMPLETED ผิด) — collection ของ order, ไม่มี payment, ยังมี payment ที่คืนไม่ครบ หรือมี session ที่ยังรอ payment
// (อาจจ่ายแล้ว webhook ยังไม่มา — review #445) → next()
export async function resetRefundedCartPaymentCollection(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment_collection",
    fields: RESET_COLLECTION_FIELDS,
    filters: { id: req.params.id },
  })
  const collection = data[0]
  if (!isResettableCollection(collection)) {
    return next()
  }

  // ไม่มี cart แล้ว = request ที่ยิงพร้อมกันถอด link ไปก่อน (ผ่าน ownership มาก่อนถอด) → ตอบ code เดิม
  const cartId = collection.cart?.id
  if (cartId) {
    const { result } = await resetCartPaymentCollectionWorkflow(req.scope).run({
      input: { cart_id: cartId, payment_collection_id: collection.id },
    })
    if (!result.reset) {
      return next()
    }
  }
  throw collectionReset()
}
