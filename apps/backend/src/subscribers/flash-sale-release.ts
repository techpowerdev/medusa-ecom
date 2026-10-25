import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { releaseFlashSaleForOrderWorkflow } from "../workflows/release-flash-sale-for-order"

// FS-2 (spec 03 กฎข้อ 10): order.canceled หรือ refund เต็มจำนวน → คืนสิทธิ์ flash ตาม reservation ของ order
// ไม่มี subscriber บน order.placed — การนับเกิดตอน complete cart แล้ว (FS-3)
// payment.refunded ของ Medusa ส่ง { id: payment_id } → หา order ผ่าน link payment_collection ↔ order
export default async function flashSaleReleaseHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (name === "order.canceled") {
    await releaseFlashSaleForOrderWorkflow(container).run({
      input: { order_id: data.id, reason: "canceled" },
    })
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection.order.id"],
    filters: { id: data.id },
  })
  const orderId = payments[0]?.payment_collection?.order?.id
  if (!orderId) {
    return
  }
  await releaseFlashSaleForOrderWorkflow(container).run({
    input: { order_id: orderId, reason: "refunded" },
  })
}

export const config: SubscriberConfig = {
  event: ["order.canceled", "payment.refunded"],
}
