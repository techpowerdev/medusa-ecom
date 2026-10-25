import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { ORDER_EMAIL_FIELDS } from "./send-order-placed-notification"

export type SendOrderShippedNotificationInput = {
  // fulfillment id จาก payload ของ event shipment.created
  id: string
}

const FULFILLMENT_EMAIL_FIELDS = [
  "id",
  "shipped_at",
  "labels.tracking_number",
  "labels.tracking_url",
  ...ORDER_EMAIL_FIELDS.map((field) => `order.${field}`),
]

export const sendOrderShippedNotificationWorkflow = createWorkflow(
  "send-order-shipped-notification",
  (input: SendOrderShippedNotificationInput) => {
    const { data: fulfillments } = useQueryGraphStep({
      entity: "fulfillment",
      fields: FULFILLMENT_EMAIL_FIELDS,
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    const notification = when(
      { fulfillments },
      ({ fulfillments }) => !!fulfillments[0]?.order?.email
    ).then(() => {
      const notifications = transform({ fulfillments }, ({ fulfillments }) => {
        const { order, ...fulfillment } = fulfillments[0]

        return [
          {
            to: order!.email!,
            channel: "email",
            template: "order-shipped",
            data: { order, fulfillment },
            trigger_type: "shipment.created",
            resource_id: fulfillment.id,
            resource_type: "fulfillment",
            idempotency_key: `order-shipped-${fulfillment.id}`,
          },
        ]
      })

      return sendNotificationsStep(notifications)
    })

    return new WorkflowResponse({ notification })
  }
)
