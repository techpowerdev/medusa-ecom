import { createHash } from "node:crypto"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService, { ClaimCodesForOrderResult } from "../../../modules/evoucher/service"
import { EmailTemplates } from "../../../modules/resend/templates"
import { EVOUCHER_NOTIFICATION_TRIGGER, EvoucherLine, EvoucherOrder } from "./evoucher-order"

/** key ต่อการ claim: code ชุดใหม่ = key ใหม่เสมอ (ไม่ชนกับ notification ของ claim ก่อนหน้าของ order เดียวกัน) */
export const evoucherClaimKey = (codeIds: string[]) =>
  createHash("sha256").update([...codeIds].sort().join(",")).digest("hex").slice(0, 32)

// AC-2: อีเมลเดียวต่อการ claim มีทุก code + PIN + วิธีใช้ + วันหมดอายุ
// owner: code/PIN ใน notification.data เป็น ciphertext เท่านั้น — Resend provider ถอดตอน render
export const buildEvoucherDeliveredNotificationStep = createStep(
  "build-evoucher-delivered-notification",
  async (
    input: { order: EvoucherOrder; lines: EvoucherLine[]; allocated: ClaimCodesForOrderResult["allocated"] },
    { container }
  ) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const codeIds = input.allocated.flatMap((a) => a.code_ids)
    const codes = await service.listEvoucherCodes(
      { id: codeIds },
      { relations: ["pool", "pool.partner"], order: { expires_at: "ASC" } }
    )
    const vouchers = input.allocated.map((a) => {
      const line = input.lines.find((l) => l.line_item_id === a.line_item_id)!
      const rows = codes.filter((c) => c.order_line_item_id === a.line_item_id)
      const pool = rows[0].pool
      return {
        title: line.title,
        partner: { name: pool.partner.name, logo_url: pool.partner.logo_url },
        how_to_use: pool.how_to_use,
        validity_note: pool.validity_note,
        codes: rows.map((c) => ({
          code: c.code,
          pin: c.pin ?? null,
          expires_at: c.expires_at ? new Date(c.expires_at).toISOString() : null,
        })),
      }
    })
    const notification: CreateNotificationDTO = {
      to: input.order.email!,
      channel: "email",
      template: EmailTemplates.EVOUCHER_DELIVERED,
      data: { order: { id: input.order.id, display_id: input.order.display_id }, vouchers },
      trigger_type: EVOUCHER_NOTIFICATION_TRIGGER,
      resource_id: input.order.id,
      resource_type: "order",
      idempotency_key: `evoucher-delivered-${input.order.id}-${evoucherClaimKey(codeIds)}`,
    }
    return new StepResponse(notification)
  }
)
