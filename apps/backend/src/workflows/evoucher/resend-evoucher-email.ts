import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { EvoucherOrder } from "./steps/evoucher-order"
import { buildEvoucherDeliveredNotificationStep } from "./steps/build-evoucher-delivered-notification"
import {
  acquireEvoucherResendLockStep,
  releaseEvoucherResendLockStep,
  resolveEvoucherResendCodesStep,
  sendEvoucherResendNotificationStep,
} from "./steps/resend-evoucher-email"

export type ResendEvoucherEmailInput = { order_id: string }

/**
 * EV-5b (spec 02): admin ส่งอีเมล `evoucher.delivered` ซ้ำไปที่อีเมลของ order ด้วย code `delivered`/`allocated` เดิม
 * (ไม่ allocate ใหม่) — template/ciphertext เดียวกับ EV-4 (กฎข้อ 16), key ใหม่ทุกครั้ง (กฎข้อ 19),
 * สำเร็จ → `allocated` เป็น `delivered` (กฎข้อ 17); lock ต่อ order กันยิงพร้อมกัน
 */
export const resendEvoucherEmailWorkflow = createWorkflow(
  "resend-evoucher-email",
  function (input: ResendEvoucherEmailInput) {
    const lock = acquireEvoucherResendLockStep({ order_id: input.order_id })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "display_id", "email", "items.id", "items.title"],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })
    const order = transform({ orders }, ({ orders }) => orders[0] as unknown as EvoucherOrder)

    const resend = resolveEvoucherResendCodesStep({ order })
    const notification = buildEvoucherDeliveredNotificationStep({
      order,
      lines: resend.lines,
      allocated: resend.allocated,
    })
    const result = sendEvoucherResendNotificationStep({ order, notification, code_ids: resend.code_ids })

    releaseEvoucherResendLockStep(lock)
    return new WorkflowResponse(result)
  }
)
