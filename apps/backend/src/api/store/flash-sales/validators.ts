import { z } from "@medusajs/framework/zod"

export const MAX_VARIANTS = 24 // PLP ~12–24 ตัว; PDP ไม่กี่ตัว

// GET /store/flash-sales/active (FS-4) — variant_ids ต้องมี region_id เพื่อหาราคา/สกุลเงิน
export const StoreGetActiveFlashSalesParams = z
  .object({
    region_id: z.string().min(1).optional(),
    variant_ids: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .pipe(z.array(z.string().min(1)).max(MAX_VARIANTS))
      .optional(),
  })
  .refine((q) => !q.variant_ids?.length || !!q.region_id, {
    message: "region_id is required when variant_ids is given",
    path: ["region_id"],
  })
export type StoreGetActiveFlashSalesParams = z.infer<typeof StoreGetActiveFlashSalesParams>

// GET /store/customers/me/flash-sales/allowance (FS-20, กฎข้อ 25) — หา variant ในแคมเปญด้วย preview ของ FS-4
// จึงต้องมี region_id (currency/rule ของ promotion) และเพดาน variant เท่า FS-4 (session หลักตัดสิน 2026-11-21)
export const StoreGetFlashSaleAllowanceParams = z.object({
  region_id: z.string().min(1),
  variant_ids: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .pipe(
      z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_VARIANTS, { message: `variant_ids accepts at most ${MAX_VARIANTS} ids per request` })
    ),
})
export type StoreGetFlashSaleAllowanceParams = z.infer<typeof StoreGetFlashSaleAllowanceParams>
