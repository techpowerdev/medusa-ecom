import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"

export type SendOrderPlacedNotificationInput = {
  id: string
}

export const ORDER_EMAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "no_notification",
  "currency_code",
  "total",
  "subtotal",
  "shipping_total",
  "tax_total",
  "items.*",
  "customer.first_name",
  "shipping_address.first_name",
]

export const sendOrderPlacedNotificationWorkflow = createWorkflow(
  "send-order-placed-notification",
  (input: SendOrderPlacedNotificationInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ORDER_EMAIL_FIELDS,
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    // CORE-11 (กฎข้อ 21): order ที่ตั้ง no_notification (Order module) ไม่ส่งอีเมล
    const notification = when(
      { orders },
      ({ orders }) => !!orders[0]?.email && !orders[0]?.no_notification
    ).then(() => {
      const notifications = transform({ orders }, ({ orders }) => [
        {
          to: orders[0].email!,
          channel: "email",
          template: "order-placed",
          data: { order: orders[0] },
          trigger_type: "order.placed",
          resource_id: orders[0].id,
          resource_type: "order",
          // event อาจถูกส่งซ้ำ — Notification Module ข้าม key ที่ส่งสำเร็จแล้ว
          idempotency_key: `order-placed-${orders[0].id}`,
        },
      ])

      return sendNotificationsStep(notifications)
    })

    return new WorkflowResponse({ notification })
  }
)
