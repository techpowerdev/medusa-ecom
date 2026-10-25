import { z } from "@medusajs/framework/zod"

// FS-5: units_sold ไม่อยู่ใน body (FS-3 เป็นผู้นับ) — strict ปฏิเสธ field ที่ไม่รู้จัก
const positiveIntOrNull = z.number().int().positive().nullish()

export const AdminUpsertFlashSaleConfig = z.strictObject({
  per_customer_limit: positiveIntOrNull,
  total_cap: positiveIntOrNull,
  show_countdown: z.boolean().optional(),
  show_remaining: z.boolean().optional(),
  banner_text: z.string().nullish(),
})
export type AdminUpsertFlashSaleConfig = z.infer<typeof AdminUpsertFlashSaleConfig>
