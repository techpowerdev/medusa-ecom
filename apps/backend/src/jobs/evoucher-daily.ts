import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bangkokDateKey, expiryCutoff } from "../modules/evoucher/utils/expiry"
import {
  EvoucherExpiryPoolResult,
  sendEvoucherStockAlertsWorkflow,
} from "../workflows/evoucher/send-evoucher-stock-alerts"
import { voidExpiringEvoucherCodesWorkflow } from "../workflows/evoucher/void-evoucher-codes"

// EV-5 (AC-5, AC-9), EV-12 (AC-30): void code ใกล้หมดอายุ (< 7 วัน) ทีละ pool — เว้นไว้เท่าที่ order ที่จองแล้วต้องใช้ —
// + ลด inventory แล้วส่งอีเมลสรุป/low-stock หา admin
// รันซ้ำในวันเดียวกันได้: void เฉพาะ code `available`, อีเมลมี idempotency key รายวัน
export default async function evoucherDailyJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()
  const expires_before = expiryCutoff(now).toISOString()

  const { data: pools } = await query.graph({ entity: "evoucher_pool", fields: ["id"] })
  const results: EvoucherExpiryPoolResult[] = []

  // แยก workflow ต่อ pool: pool ที่ inventory ตั้งค่าผิดไม่ทำให้ pool อื่นค้าง (compensation คืน code ของ pool นั้น)
  for (const pool of pools) {
    try {
      const { result } = await voidExpiringEvoucherCodesWorkflow(container).run({
        input: { pool_id: pool.id, now: now.toISOString(), expires_before },
      })
      if (result.voided > 0 || result.kept > 0) {
        results.push(result)
      }
    } catch (error) {
      logger.error(
        `evoucher-daily: failed to void expiring codes of pool ${pool.id}: ${(error as Error).message}`
      )
    }
  }

  // owner ตัดสิน Q-A: อีเมลแจ้ง admin ส่งหา mailbox เดียวจาก env; ไม่ได้ตั้ง → เตือนแล้วข้าม (void ด้านบนทำไปแล้ว)
  const to = process.env.EVOUCHER_ADMIN_EMAIL?.trim()
  if (!to) {
    logger.warn("evoucher-daily: EVOUCHER_ADMIN_EMAIL is not set — skipping low-stock/expiry admin emails")
    return
  }

  await sendEvoucherStockAlertsWorkflow(container).run({
    input: { to, date: bangkokDateKey(now), pools: results },
  })
}

export const config = {
  name: "evoucher-daily",
  // 01:00 เวลาไทย เมื่อ server ใช้ UTC (container ของ prod)
  schedule: "0 18 * * *",
}
