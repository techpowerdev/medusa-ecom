import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bangkokDateKey, expiryCutoff } from "../modules/evoucher/utils/expiry"
import { sendEvoucherStockAlertsWorkflow } from "../workflows/evoucher/send-evoucher-stock-alerts"
import { voidExpiringEvoucherCodesWorkflow } from "../workflows/evoucher/void-evoucher-codes"

// EV-5 (AC-5, AC-9): void code ใกล้หมดอายุ (< 7 วัน) ทีละ pool + ลด inventory แล้วส่งอีเมลสรุป/low-stock หา admin
// รันซ้ำในวันเดียวกันได้: void เฉพาะ code `available`, อีเมลมี idempotency key รายวัน
export default async function evoucherDailyJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()
  const expires_before = expiryCutoff(now).toISOString()

  const { data: pools } = await query.graph({ entity: "evoucher_pool", fields: ["id"] })
  const voided: { pool_id: string; voided: number }[] = []

  // แยก workflow ต่อ pool: pool ที่ inventory ตั้งค่าผิดไม่ทำให้ pool อื่นค้าง (compensation คืน code ของ pool นั้น)
  for (const pool of pools) {
    try {
      const { result } = await voidExpiringEvoucherCodesWorkflow(container).run({
        input: { pool_id: pool.id, expires_before },
      })
      if (result.voided > 0) {
        voided.push(result)
      }
    } catch (error) {
      logger.error(
        `evoucher-daily: failed to void expiring codes of pool ${pool.id}: ${(error as Error).message}`
      )
    }
  }

  await sendEvoucherStockAlertsWorkflow(container).run({
    input: { date: bangkokDateKey(now), voided },
  })
}

export const config = {
  name: "evoucher-daily",
  // 01:00 เวลาไทย เมื่อ server ใช้ UTC (container ของ prod)
  schedule: "0 18 * * *",
}
