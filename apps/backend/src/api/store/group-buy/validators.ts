import { z } from "@medusajs/framework/zod"

// spec 04 API: store route สร้างได้เฉพาะ team — ไม่รับ kind จาก body (strict → 400)
export const StoreCreateGroupBuyGroup = z
  .object({
    campaign_id: z.string().min(1),
    name: z.string().trim().min(1).nullish(),
  })
  .strict()
export type StoreCreateGroupBuyGroup = z.infer<typeof StoreCreateGroupBuyGroup>

export const StoreJoinGroupBuyGroup = z.object({ cart_id: z.string().min(1) }).strict()
export type StoreJoinGroupBuyGroup = z.infer<typeof StoreJoinGroupBuyGroup>

// GB-8 (spec 04 API รอบ 10): อ่านอย่างเดียว ไม่รับ fields/order — limit 1..100 ค่าเริ่มต้น 20, offset ≥ 0
export const StoreListMyGroupBuyMemberships = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
