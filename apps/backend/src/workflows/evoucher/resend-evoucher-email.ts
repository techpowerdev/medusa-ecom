import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { buildEvoucherDeliveredNotificationStep } from "./steps/build-evoucher-delivered-notification"
import { createEvoucherShipmentsStep } from "./steps/create-evoucher-shipments"
import {
  acquireEvoucherResendLockStep,
  EvoucherResendOrder,
  releaseEvoucherResendLockStep,
  resolveEvoucherResendCodesStep,
  sendEvoucherResendNotificationStep,
} from "./steps/resend-evoucher-email"

export type ResendEvoucherEmailInput = { order_id: string }

/**
 * EV-5b (spec 02): admin ส่งอีเมล `evoucher.delivered` ซ้ำไปที่อีเมลของ order ด้วย code `delivered`/`allocated` เดิม
 * (ไม่ allocate ใหม่) — template/ciphertext เดียวกับ EV-4 (กฎข้อ 16), key ใหม่ทุกครั้ง (กฎข้อ 19),
 * สำเร็จ → `allocated` เป็น `delivered` (กฎข้อ 17); lock ต่อ order กันยิงพร้อมกัน
 * EV-17 (กฎข้อ 33d): สำเร็จ → shipment แบบ no_notification ของ fulfillment ที่ยังไม่ shipped (อีเมลล้ม → step ส่ง throw ไปไม่ถึง)
 */
export const resendEvoucherEmailWorkflow = createWorkflow(
  "resend-evoucher-email",
  function (input: ResendEvoucherEmailInput) {
    const lock = acquireEvoucherResendLockStep({ order_id: input.order_id })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      // EV-9: code ของ order มาจาก link order ↔ evoucher_code (src/links/order-evoucher-code.ts)
      fields: [
        "id",
        "display_id",
        "email",
        "items.id",
        "items.title",
        "evoucher_codes.id",
        "evoucher_codes.status",
        "evoucher_codes.order_line_item_id",
        "evoucher_codes.created_at",
        "evoucher_codes.pool.id",
        "evoucher_codes.pool.name",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })
    const order = transform({ orders }, ({ orders }) => orders[0] as unknown as EvoucherResendOrder)

    const resend = resolveEvoucherResendCodesStep({ order })
    const notification = buildEvoucherDeliveredNotificationStep({
      order,
      lines: resend.lines,
      allocated: resend.allocated,
    })
    const result = sendEvoucherResendNotificationStep({ order, notification, code_ids: resend.code_ids })
    const shipmentInput = transform({ input, resend }, ({ input, resend }) => ({
      order_id: input.order_id,
      line_item_ids: resend.allocated.map((a) => a.line_item_id),
      // คงที่: มาถึงตรงนี้ได้แปลว่าอีเมลสำเร็จ — sendEvoucherResendNotificationStep throw เมื่ออีเมลล้ม (กฎข้อ 33e)
      sent: true,
    }))
    createEvoucherShipmentsStep(shipmentInput)

    releaseEvoucherResendLockStep(lock)
    return new WorkflowResponse(result)
  }
)
