import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { findActiveOrderChangeOfPayment } from "../../../lib/active-order-change"

// PAY-8 (spec 06 กฎข้อ 10, bug B-1): refundPaymentWorkflow ของ Medusa 2.22.1 คืนเงินที่ provider ก่อนสร้าง credit line
// ซึ่งล้มเมื่อ order มี active order change → เงินคืนจริงแต่ admin เห็น 400 และไม่ emit payment.refunded
// (flash-sale-release / affiliate-reversal ไม่ทำงาน) → ปฏิเสธก่อนเข้า route; ไม่แตะ workflow ของ Medusa
export const ACTIVE_ORDER_CHANGE_REFUND_MESSAGE =
  "Cannot refund while this order has an active return, claim, exchange or edit. Confirm or cancel it first."

export async function guardRefundWithActiveOrderChange(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  if (await findActiveOrderChangeOfPayment(query, req.params.id)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, ACTIVE_ORDER_CHANGE_REFUND_MESSAGE)
  }
  next()
}

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว
export const adminPaymentMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/payments/:id/refund",
    middlewares: [guardRefundWithActiveOrderChange],
  },
]
