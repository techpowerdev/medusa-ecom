import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, OrderStatus } from "@medusajs/framework/utils"
import { sendOrderPlacedNotificationWorkflow } from "../workflows/send-order-placed-notification"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  // CORE-74 (กฎข้อ 132): event อาจค้างใน queue ขณะ worker หยุด — อ่านสถานะล่าสุด ถ้ายกเลิกไปแล้วไม่ส่งอีเมล
  const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "status"],
    filters: { id: data.id },
  })
  if (orders[0]?.status === OrderStatus.CANCELED) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(`order_placed_email_skipped_canceled order_id=${data.id}`)
    return
  }

  await sendOrderPlacedNotificationWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
