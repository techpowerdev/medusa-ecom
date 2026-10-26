import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService from "../../../modules/evoucher/service"
import { EmailTemplates } from "../../../modules/resend/templates"
import { EVOUCHER_NOTIFICATION_TRIGGER, EvoucherOrder } from "./evoucher-order"

// ข้อความ error ในอีเมล admin/log: เฉพาะ message (ไม่ใส่ data ของ notification) ยุบบรรทัดและตัดไม่เกิน 200 ตัวอักษร
const shortError = (error: unknown) =>
  String((error as Error)?.message ?? error)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)

/**
 * ขั้นสุดท้ายของ allocate & deliver — **ไม่ throw** (จึงไม่มี compensation คืน code ที่ลูกค้าอาจได้รับแล้วเข้า pool)
 * - ส่งสำเร็จ → mark code `delivered` (ถ้า mark ล้ม: log error, code คง `allocated` ส่งซ้ำผ่าน resend ได้)
 * - ส่งล้ม (กฎข้อ 17) → code คง `allocated` กับ order (ไม่คืน pool/ไม่ void) + แจ้ง EVOUCHER_ADMIN_EMAIL ให้ resend (EV-5b)
 */
export const sendEvoucherDeliveredNotificationStep = createStep(
  "send-evoucher-delivered-notification",
  async (
    input: {
      order: EvoucherOrder
      notification: CreateNotificationDTO
      code_ids: string[]
      admin_email?: string
    },
    { container }
  ) => {
    const notifications = container.resolve(Modules.NOTIFICATION)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    try {
      await notifications.createNotifications([input.notification])
    } catch (error) {
      const message = shortError(error)
      logger.warn(
        `evoucher: delivery email for order ${input.order.id} failed: ${message} — codes stay allocated to the order, resend required (EV-5b)`
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
        logger.error(`evoucher: admin alert for order ${input.order.id} failed: ${shortError(alertError)}`)
      }
      return new StepResponse({ sent: false })
    }

    try {
      const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
      await service.updateEvoucherCodes({
        selector: { id: input.code_ids, status: "allocated" },
        data: { status: "delivered", delivered_at: new Date(), delivered_to_email: input.order.email ?? null },
      })
    } catch (error) {
      logger.error(
        `evoucher: email sent for order ${input.order.id} but marking codes delivered failed: ${shortError(error)} — ` +
          `codes stay allocated, resend (EV-5b) marks them delivered`
      )
    }
    return new StepResponse({ sent: true })
  }
)
