import { z } from "@medusajs/framework/zod"

// code is the public slug in tracking links (`/r/<code>`)
export const PostAffiliateRegisterSchema = z.object({
  name: z.string().trim().min(1),
  code: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, "code must be a 3-32 char lowercase slug"),
})

export type PostAffiliateRegisterSchemaType = z.infer<typeof PostAffiliateRegisterSchema>

// AF-7: status = active (อยู่ในช่วงเวลา) | upcoming (starts_at > now) ของโปรแกรม published (กฎ 9); page เริ่มที่ 1
export const GetAffiliateProductsSchema = z
  .object({
    status: z.enum(["active", "upcoming"]).default("active"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
export type GetAffiliateProductsSchemaType = z.infer<typeof GetAffiliateProductsSchema>

// ช่วง [from, to) ของ created_at ของ entry
export const GetAffiliateEarningsSchema = z
  .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })
  .strict()
export type GetAffiliateEarningsSchemaType = z.infer<typeof GetAffiliateEarningsSchema>
