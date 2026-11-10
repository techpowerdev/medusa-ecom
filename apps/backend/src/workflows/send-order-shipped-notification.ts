import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { ORDER_EMAIL_FIELDS } from "./send-order-placed-notification"
import { toShippedItems } from "../lib/shipped-items"

export type SendOrderShippedNotificationInput = {
  // fulfillment id จาก payload ของ event shipment.created
  id: string
}

const FULFILLMENT_EMAIL_FIELDS = [
  "id",
  "shipped_at",
  "labels.tracking_number",
  "labels.tracking_url",
  "items.line_item_id",
  "items.inventory_item_id",
  "items.quantity",
  ...ORDER_EMAIL_FIELDS.map((field) => `order.${field}`),
  // fulfillment item ของ variant ที่ manage inventory มีหนึ่งแถวต่อ inventory item (quantity × required_quantity)
  "order.items.variant.inventory_items.inventory_item_id",
  "order.items.variant.inventory_items.required_quantity",
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

    // CORE-11 (กฎข้อ 20): อีเมลแสดงเฉพาะ item/จำนวนใน fulfillment นี้ ไม่ใช่ทุก item ของ order
    const shipment = transform({ fulfillments }, ({ fulfillments }) => {
      const { order, ...fulfillment } = fulfillments[0]
      const items = order ? toShippedItems(order.items, fulfillment.items) : []
      return { order, fulfillment, items }
    })

    // ไม่มี item ที่จับคู่กับ order ได้ → ไม่ส่งอีเมล shipped ที่ว่างเปล่า
    const notification = when(
      { shipment },
      ({ shipment }) => !!shipment.order?.email && shipment.items.length > 0
    ).then(() => {
      const notifications = transform({ shipment }, ({ shipment }) => {
        const { order, fulfillment, items } = shipment
        return [
          {
            to: order!.email!,
            channel: "email",
            template: "order-shipped",
            data: { order: { ...order, items }, fulfillment },
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
