import { z } from "@medusajs/framework/zod"

const MAX_VARIANTS = 100

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
