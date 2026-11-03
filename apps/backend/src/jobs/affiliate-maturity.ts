import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, defineFileConfig } from "@medusajs/framework/utils"
import { scheduledJobsDisabled } from "../lib/scheduled-jobs"
import { approveMaturedCommissionEntriesWorkflow } from "../workflows/affiliate/approve-matured-entries"

// AF-4 (spec 05, AC-6): entry `pending` ที่ครบ hold_days → `approved` (Q8: ยอดสุทธิของ line > 0)
export default async function affiliateMaturityJob(container: MedusaContainer) {
  const { result } = await approveMaturedCommissionEntriesWorkflow(container).run({
    input: { now: new Date().toISOString() },
  })
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`affiliate-maturity: approved ${result.length} commission entries`)
}

export const config = {
  name: "affiliate-maturity",
  // 02:00 เวลาไทย เมื่อ server ใช้ UTC (หลัง evoucher-daily)
  schedule: "0 19 * * *",
}

// OPS-15b (spec 07 AC-26): ไม่ลงทะเบียน cron ใน integration test — ดู src/lib/scheduled-jobs.ts
defineFileConfig({ isDisabled: () => scheduledJobsDisabled() })
