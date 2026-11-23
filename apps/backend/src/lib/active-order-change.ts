import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { OrderChangeStatus } from "@medusajs/framework/utils"

// PAY-8 (spec 06 กฎข้อ 10a/b): order change ที่ "active" = status เดียวกับที่ order module ของ Medusa 2.22.1
// ใช้ปฏิเสธการสร้าง order change ใหม่ ("already has an existing active order change")
export const ACTIVE_ORDER_CHANGE_STATUSES = [OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED]

export type ActiveOrderChange = { id: string; change_type: string | null; status: string; order_id: string }

type Query = Pick<RemoteQueryFunction, "graph">

// payment → payment collection → link order_payment_collection → order_change ที่ active (null = ไม่มี payment/order/change)
export async function findActiveOrderChangeOfPayment(
  query: Query,
  paymentId: string
): Promise<ActiveOrderChange | null> {
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id"],
    filters: { id: paymentId },
  })
  const collectionId = payments[0]?.payment_collection_id
  if (!collectionId) {
    return null
  }

  const { data: links } = await query.graph({
    entity: "order_payment_collection",
    fields: ["order_id"],
    filters: { payment_collection_id: collectionId },
  })
  const orderId = links[0]?.order_id as string | undefined
  if (!orderId) {
    return null
  }

  const { data: changes } = await query.graph({
    entity: "order_change",
    fields: ["id", "change_type", "status"],
    filters: { order_id: orderId, status: ACTIVE_ORDER_CHANGE_STATUSES },
  })
  const change = changes[0]
  return change ? { id: change.id, change_type: change.change_type ?? null, status: change.status, order_id: orderId } : null
}
