import { z } from "@medusajs/framework/zod"

// FS-5: units_sold ไม่อยู่ใน body (FS-3 เป็นผู้นับ) — strict ปฏิเสธ field ที่ไม่รู้จัก
// min(1) ไม่ใช่ positive(): error ของ Medusa แสดง "expected at least: '1'" (positive ได้ '0' ซึ่งชวนเข้าใจผิด)
const positiveIntOrNull = z.number().int().min(1).nullish()

export const AdminUpsertFlashSaleConfig = z.strictObject({
  per_customer_limit: positiveIntOrNull,
  total_cap: positiveIntOrNull,
  show_countdown: z.boolean().optional(),
  show_remaining: z.boolean().optional(),
  banner_text: z.string().nullish(),
})
export type AdminUpsertFlashSaleConfig = z.infer<typeof AdminUpsertFlashSaleConfig>
