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
