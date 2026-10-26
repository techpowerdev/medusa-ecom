import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { EmailTemplates } from "../../../modules/resend/templates"
import { EVOUCHER_NOTIFICATION_TRIGGER, EvoucherOrder } from "./evoucher-order"

/**
 * owner: อีเมลลูกค้าส่งไม่สำเร็จ → ไม่ throw (ไม่ compensate) code อยู่กับ order ต่อ (ห้ามคืนเข้า pool/ขายซ้ำ)
 * แล้วแจ้ง EVOUCHER_ADMIN_EMAIL ให้ส่งซ้ำ (กฎข้อ 9; ไม่ได้ตั้ง → log warning)
 * ไม่มี compensation: อีเมลที่ส่งแล้วเรียกคืนไม่ได้
 */
export const sendEvoucherDeliveredNotificationStep = createStep(
  "send-evoucher-delivered-notification",
  async (
    input: { order: EvoucherOrder; notification: CreateNotificationDTO; admin_email?: string },
    { container }
  ) => {
    const notifications = container.resolve(Modules.NOTIFICATION)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    try {
      await notifications.createNotifications([input.notification])
      return new StepResponse({ sent: true })
    } catch (error) {
      const message = (error as Error).message
      logger.warn(
        `evoucher: delivery email for order ${input.order.id} failed: ${message} — codes stay with the order, resend required`
      )
      if (!input.admin_email) {
        logger.warn(
          `evoucher: EVOUCHER_ADMIN_EMAIL is not set — no admin alert for the failed delivery email of order ${input.order.id}`
        )
        return new StepResponse({ sent: false })
      }
      try {
        await notifications.createNotifications([
          {
            to: input.admin_email,
            channel: "email",
            template: EmailTemplates.EVOUCHER_DELIVERY_FAILED,
            data: {
              order: { id: input.order.id, display_id: input.order.display_id, email: input.order.email },
              error: message,
            },
            trigger_type: EVOUCHER_NOTIFICATION_TRIGGER,
            resource_id: input.order.id,
            resource_type: "order",
            idempotency_key: `${input.notification.idempotency_key}-failed`,
          },
        ])
      } catch (alertError) {
        logger.error(
          `evoucher: admin alert for order ${input.order.id} failed: ${(alertError as Error).message}`
        )
      }
      return new StepResponse({ sent: false })
    }
  }
)
