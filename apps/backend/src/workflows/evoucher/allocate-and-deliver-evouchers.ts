import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createOrderFulfillmentWorkflow,
  sendNotificationsStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { EvoucherOrder } from "./steps/evoucher-order"
import { resolveEvoucherLinesStep } from "./steps/resolve-evoucher-lines"
import { claimEvoucherCodesStep } from "./steps/claim-evoucher-codes"
import { updateEvoucherBackorderedFlagsStep } from "./steps/update-evoucher-backordered-flags"
import { buildEvoucherBackorderedNotificationsStep } from "./steps/build-evoucher-backordered-notifications"
import { resolveDigitalShippingOptionStep } from "./steps/resolve-digital-shipping-option"
import { markEvoucherCodesDeliveredStep } from "./steps/mark-evoucher-codes-delivered"
import { buildEvoucherDeliveredNotificationStep } from "./steps/build-evoucher-delivered-notification"
import { sendEvoucherDeliveredNotificationStep } from "./steps/send-evoucher-delivered-notification"

export { EVOUCHER_BACKORDERED_METADATA_KEY } from "./steps/evoucher-order"

export type AllocateAndDeliverEvouchersInput = {
  order_id: string
  /** mailbox เดียวของทีม (env `EVOUCHER_ADMIN_EMAIL`, กฎข้อ 9) — ไม่ได้ตั้ง → log warning และไม่ส่ง */
  admin_email?: string
}

/**
 * EV-4 (spec 02, ADR-006): หลัง payment.captured → claim code ต่อ voucher line item × quantity →
 * flag backordered (ทั้ง line item; ล้าง flag เมื่อส่งมอบได้) + อีเมล admin (กฎข้อ 9) →
 * fulfillment ผ่าน provider digital → mark delivered → อีเมล `evoucher.delivered` (ciphertext; ล้มแล้วแจ้ง admin ไม่คืน code)
 * Idempotent (AC-7): line item ที่มี code แล้วถูกข้าม; key อีเมลต่อการ claim
 */
export const allocateAndDeliverEvouchersWorkflow = createWorkflow(
  "allocate-and-deliver-evouchers",
  function (input: AllocateAndDeliverEvouchersInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "customer_id",
        "items.id",
        "items.title",
        "items.variant_id",
        "items.quantity",
        "items.metadata",
        "items.variant.product.shipping_profile.type",
        "shipping_methods.shipping_option_id",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })
    const order = transform({ orders }, ({ orders }) => orders[0] as unknown as EvoucherOrder)

    const lines = resolveEvoucherLinesStep({ order })
    const claim = claimEvoucherCodesStep({ order, lines })

    const flags = transform({ claim }, ({ claim }) => ({
      backordered: claim.backordered,
      allocated: claim.allocated.map((a) => a.line_item_id),
    }))
    updateEvoucherBackorderedFlagsStep({ order, backordered: flags.backordered, allocated: flags.allocated })

    const adminNotifications = buildEvoucherBackorderedNotificationsStep({
      order,
      lines,
      backordered: flags.backordered,
      admin_email: input.admin_email,
    })
    when({ adminNotifications }, ({ adminNotifications }) => adminNotifications.length > 0).then(() => {
      sendNotificationsStep(adminNotifications).config({ name: "send-evoucher-backordered-notifications" })
    })

    when({ claim }, ({ claim }) => claim.allocated.length > 0).then(() => {
      const shippingOptionId = resolveDigitalShippingOptionStep({ order })
      const fulfillmentInput = transform({ order, claim, lines, shippingOptionId }, (data) => ({
        order_id: data.order.id,
        shipping_option_id: data.shippingOptionId,
        items: data.claim.allocated.map((a) => ({
          id: a.line_item_id,
          quantity: data.lines.find((l) => l.line_item_id === a.line_item_id)!.quantity,
        })),
      }))
      createOrderFulfillmentWorkflow.runAsStep({ input: fulfillmentInput })

      const codeIds = transform({ claim }, ({ claim }) => claim.allocated.flatMap((a) => a.code_ids))
      markEvoucherCodesDeliveredStep({ code_ids: codeIds, email: order.email })

      const notification = buildEvoucherDeliveredNotificationStep({
        order,
        lines,
        allocated: claim.allocated,
      })
      sendEvoucherDeliveredNotificationStep({ order, notification, admin_email: input.admin_email })
    })

    return new WorkflowResponse(claim)
  }
)
