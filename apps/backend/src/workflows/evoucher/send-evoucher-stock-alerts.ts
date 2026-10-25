import {
  createStep,
  createWorkflow,
  StepResponse,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"
import { EmailTemplates } from "../../modules/resend/templates"

export type SendEvoucherStockAlertsInput = {
  /** วันที่ตามปฏิทินไทย (YYYY-MM-DD) — ส่วนหนึ่งของ idempotency key: 1 ฉบับต่อวันต่อ pool (AC-9) */
  date: string
  /** ผลการ void ของ job วันนี้ (เฉพาะ pool ที่ void > 0) */
  voided: { pool_id: string; voided: number }[]
}

const TRIGGER = "evoucher.daily"

// ผู้รับ = admin user ทุกคนของ Medusa (User module); ไม่มี config ผู้รับแยกใน spec
export const buildEvoucherStockAlertsStep = createStep(
  "build-evoucher-stock-alerts",
  async (input: SendEvoucherStockAlertsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)

    const { data: users } = await query.graph({ entity: "user", fields: ["email"] })
    const recipients = [...new Set(users.map((u) => u.email).filter(Boolean))]
    if (!recipients.length) {
      return new StepResponse([] as CreateNotificationDTO[])
    }

    const { data: pools } = await query.graph({
      entity: "evoucher_pool",
      fields: ["id", "name", "low_stock_threshold"],
    })
    const notifications: CreateNotificationDTO[] = []

    for (const pool of pools) {
      const [, available] = await service.listAndCountEvoucherCodes(
        { pool_id: pool.id, status: "available" },
        { select: ["id"], take: 1 }
      )
      if (available >= pool.low_stock_threshold) {
        continue
      }
      for (const to of recipients) {
        notifications.push({
          to,
          channel: "email",
          template: EmailTemplates.EVOUCHER_LOW_STOCK,
          data: {
            pool: {
              id: pool.id,
              name: pool.name,
              available,
              low_stock_threshold: pool.low_stock_threshold,
            },
          },
          trigger_type: TRIGGER,
          resource_id: pool.id,
          resource_type: "evoucher_pool",
          idempotency_key: `evoucher-low-stock-${pool.id}-${input.date}-${to}`,
        })
      }
    }

    const names = new Map(pools.map((p) => [p.id, p.name]))
    const voided = input.voided.filter((v) => v.voided > 0)
    const total = voided.reduce((sum, v) => sum + v.voided, 0)
    if (total > 0) {
      for (const to of recipients) {
        notifications.push({
          to,
          channel: "email",
          template: EmailTemplates.EVOUCHER_EXPIRY_SUMMARY,
          data: {
            date: input.date,
            total_voided: total,
            pools: voided.map((v) => ({
              id: v.pool_id,
              name: names.get(v.pool_id) ?? v.pool_id,
              voided: v.voided,
            })),
          },
          trigger_type: TRIGGER,
          idempotency_key: `evoucher-expiry-summary-${input.date}-${to}`,
        })
      }
    }

    return new StepResponse(notifications)
  }
)

// AC-5 (สรุปหา admin) + AC-9 (low-stock) — ส่งผ่าน Notification module ของ Medusa
export const sendEvoucherStockAlertsWorkflow = createWorkflow(
  "send-evoucher-stock-alerts",
  function (input: SendEvoucherStockAlertsInput) {
    const notifications = buildEvoucherStockAlertsStep(input)
    when({ notifications }, ({ notifications }) => notifications.length > 0).then(() => {
      sendNotificationsStep(notifications)
    })
    return new WorkflowResponse(notifications)
  }
)
