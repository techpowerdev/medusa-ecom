import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createOrderFulfillmentWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { EvoucherOrder } from "./steps/evoucher-order"
import { resolveEvoucherLinesStep } from "./steps/resolve-evoucher-lines"
import { claimEvoucherCodesStep } from "./steps/claim-evoucher-codes"
import { updateEvoucherBackorderedFlagsStep } from "./steps/update-evoucher-backordered-flags"
import { buildEvoucherBackorderedNotificationsStep } from "./steps/build-evoucher-backordered-notifications"
import { sendEvoucherAdminNotificationsStep } from "./steps/send-evoucher-admin-notifications"
import { resolveDigitalShippingOptionStep } from "./steps/resolve-digital-shipping-option"
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
 * fulfillment ผ่าน provider digital → อีเมล `evoucher.delivered` (ciphertext, กฎข้อ 16) → สำเร็จจึง mark `delivered`;
 * ส่งล้ม → code คง `allocated` กับ order + แจ้ง admin ให้ resend (กฎข้อ 17)
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
        "items.variant.product.id",
        "items.variant.product.shipping_profile.id",
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
    // ไม่ throw: อีเมล admin ล้มต้องไม่ compensate claim ของ line ที่ครบ (spec 02 "backordered ไม่ทำให้ order ล้มเหลว")
    sendEvoucherAdminNotificationsStep(adminNotifications)

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
      const notification = buildEvoucherDeliveredNotificationStep({
        order,
        lines,
        allocated: claim.allocated,
      })
      // ขั้นสุดท้ายและไม่ throw: mark `delivered` เฉพาะเมื่อส่งสำเร็จ; ล้ม → คง `allocated` + แจ้ง admin (กฎข้อ 17)
      sendEvoucherDeliveredNotificationStep({
        order,
        notification,
        code_ids: codeIds,
        admin_email: input.admin_email,
      })
    })

    return new WorkflowResponse(claim)
  }
)
