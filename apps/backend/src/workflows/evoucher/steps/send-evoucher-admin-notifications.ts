import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { shortError } from "./send-evoucher-delivered-notification"

/**
 * อีเมลแจ้ง admin (backordered) — **ไม่ throw**: spec 02 "backordered ไม่ทำให้ order ล้มเหลว"
 * ถ้า throw จะ compensate claim ของ line ที่ครบและลบ flag backordered; รันซ้ำด้วย key ที่ failure ก็ล้มซ้ำ
 * ล้ม → logger.error (flag ใน metadata ยังอยู่ให้ admin เห็น)
 */
export const sendEvoucherAdminNotificationsStep = createStep(
  "send-evoucher-admin-notifications",
  async (notifications: CreateNotificationDTO[], { container }) => {
    if (!notifications.length) {
      return new StepResponse({ sent: false })
    }
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications(notifications)
      return new StepResponse({ sent: true })
    } catch (error) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(
          `evoucher: admin email (${notifications.map((n) => n.template).join(", ")}) for ` +
            `${notifications.map((n) => n.resource_id).join(", ")} failed: ${shortError(error)}`
        )
      return new StepResponse({ sent: false })
    }
  }
)
