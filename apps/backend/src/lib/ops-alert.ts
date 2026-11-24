import type { FilterableNotificationProps, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, NotificationStatus } from "@medusajs/framework/utils"

// PAY-20 (spec 06 กฎข้อ 22c–d, ADR-029): แจ้ง ops ทาง log + อีเมล OPS_ALERT_EMAIL แบบ best-effort — ใช้ใน PAY-20 และ PAY-21
// กันส่งซ้ำด้วย idempotency_key ของ Notification module (ไม่เพิ่ม table)
export type OpsAlert = {
  code: string
  template: string
  idempotency_key: string
  resource_type: string
  resource_id: string
  data: Record<string, unknown>
}

export type OpsAlertResult = "duplicate" | "sent" | "skipped" | "failed"

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * มี notification ของ key นี้ที่ไม่ใช่ failure แล้ว → "duplicate" (ไม่ log/ไม่ส่ง); ไม่งั้น `logger.error` หนึ่งบรรทัดขึ้นต้นด้วย code
 * (แถว failure เดิมถูก soft-delete ก่อนส่งใหม่)
 * แล้วส่งอีเมล — ไม่ตั้ง OPS_ALERT_EMAIL → warn "skipped"; ส่งล้ม → log error "failed" (ไม่ throw)
 */
export async function sendOpsAlert(
  container: MedusaContainer,
  alert: OpsAlert,
  env: Record<string, string | undefined> = process.env
): Promise<OpsAlertResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)

  // idempotency_key เป็น column ของ notification (unique) แต่ FilterableNotificationProps ของ 2.22.1 ไม่ประกาศ
  const existing = await notification.listNotifications(
    { idempotency_key: alert.idempotency_key } as unknown as FilterableNotificationProps,
    { select: ["id", "status"] }
  )
  if (existing.some((n) => n.status !== NotificationStatus.FAILURE)) {
    return "duplicate"
  }

  const fields = Object.entries(alert.data)
    .map(([key, value]) => `${key}=${value ?? null}`)
    .join(" ")
  logger.error(`${alert.code} ${fields}`)

  const to = env.OPS_ALERT_EMAIL?.trim()
  if (!to) {
    logger.warn(`${alert.code}: OPS_ALERT_EMAIL is not set — skipping the ops alert email`)
    return "skipped"
  }
  try {
    // review #550: Medusa 2.22.1 ส่งซ้ำแถว `failure` เดิมไม่ได้ (ส่งด้วย id ใหม่แล้ว update แถวที่ไม่มี → NOT_FOUND แถวเดิมค้าง failure
    // → ส่งซ้ำทุกรอบ) — soft-delete แถวที่ล้มก่อน (unique index ของ idempotency_key ไม่นับแถวที่ลบ) ให้ Medusa สร้างแถวใหม่ตามปกติ
    const failed = existing.map((n) => n.id)
    if (failed.length) {
      // softDeleteNotifications มีใน MedusaService ของ Notification module แต่ INotificationModuleService ของ 2.22.1 ไม่ประกาศ
      await (notification as unknown as { softDeleteNotifications(ids: string[]): Promise<unknown> }).softDeleteNotifications(failed)
    }
    await notification.createNotifications({
      to,
      channel: "email",
      template: alert.template,
      data: { code: alert.code, ...alert.data },
      idempotency_key: alert.idempotency_key,
      resource_type: alert.resource_type,
      resource_id: alert.resource_id,
    })
    return "sent"
  } catch (error) {
    logger.error(`${alert.code}: OPS_ALERT_EMAIL send failed: ${errorMessage(error)}`)
    return "failed"
  }
}
