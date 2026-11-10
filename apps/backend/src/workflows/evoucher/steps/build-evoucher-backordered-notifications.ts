import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { EmailTemplates } from "../../../modules/resend/templates"
import { EVOUCHER_NOTIFICATION_TRIGGER, EvoucherLine, EvoucherOrder } from "./evoucher-order"

// กฎข้อ 9 / AC-17: อีเมล backordered ถึง EVOUCHER_ADMIN_EMAIL เท่านั้น
export const buildEvoucherBackorderedNotificationsStep = createStep(
  "build-evoucher-backordered-notifications",
  async (
    input: { order: EvoucherOrder; lines: EvoucherLine[]; backordered: string[]; admin_email?: string },
    { container }
  ) => {
    if (!input.backordered.length) {
      return new StepResponse([] as CreateNotificationDTO[])
    }
    if (!input.admin_email) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `evoucher: order ${input.order.id} is backordered but EVOUCHER_ADMIN_EMAIL is not set — skipping admin email`
        )
      return new StepResponse([] as CreateNotificationDTO[])
    }
    const ids = [...input.backordered].sort()
    const notification: CreateNotificationDTO = {
      to: input.admin_email,
      channel: "email",
      template: EmailTemplates.EVOUCHER_BACKORDERED,
      data: {
        order: { id: input.order.id, display_id: input.order.display_id, email: input.order.email },
        items: input.lines
          .filter((l) => ids.includes(l.line_item_id))
          .map((l) => ({
            line_item_id: l.line_item_id,
            title: l.title,
            quantity: l.quantity,
            pool_name: l.pool_name,
          })),
      },
      trigger_type: EVOUCHER_NOTIFICATION_TRIGGER,
      resource_id: input.order.id,
      resource_type: "order",
      // AC-7: รันซ้ำแล้วยัง backordered ชุดเดิม → ไม่แจ้ง admin ซ้ำ (ไม่มี claim เกิดขึ้น)
      idempotency_key: `evoucher-backordered-${input.order.id}-${ids.join(",")}`,
    }
    return new StepResponse([notification])
  }
)
