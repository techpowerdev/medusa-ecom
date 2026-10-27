import type { MedusaContainer } from "@medusajs/framework/types"
import { createOrderFulfillmentWorkflow, createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"

// CORE-20b (AC-95): POST /store/returns คืนได้เฉพาะ line ที่ส่งแล้ว — fulfill + ship ผ่าน workflow ของ Medusa
// (เหมือน admin กด fulfill แล้ว mark as shipped) คืน id ของ fulfillment ให้ test ปรับ shipped_at/delivered_at ต่อได้
export async function shipOrderItems(
  container: MedusaContainer,
  orderId: string,
  items: { id: string; quantity: number }[]
): Promise<string> {
  const { result: fulfillment } = await createOrderFulfillmentWorkflow(container).run({
    input: { order_id: orderId, items },
  })
  await createOrderShipmentWorkflow(container).run({
    input: { order_id: orderId, fulfillment_id: fulfillment.id, items },
  })
  return fulfillment.id
}
