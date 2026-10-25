import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderShippedNotificationWorkflow } from "../workflows/send-order-shipped-notification"

// createShipmentWorkflow ของ Medusa emit `shipment.created` พร้อม { id: fulfillment_id, no_notification }
export default async function shipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) {
    return
  }

  await sendOrderShippedNotificationWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
