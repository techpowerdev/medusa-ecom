import { z } from "@medusajs/framework/zod"

// EV-7a (spec 02 API, กฎข้อ 22): รับเฉพาะ limit/offset — fields กำหนดใน route
export const StoreListMyEvouchers = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
