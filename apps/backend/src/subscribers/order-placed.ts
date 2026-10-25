import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderPlacedNotificationWorkflow } from "../workflows/send-order-placed-notification"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendOrderPlacedNotificationWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
