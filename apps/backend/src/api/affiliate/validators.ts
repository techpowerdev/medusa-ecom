import { z } from "@medusajs/framework/zod"

// AF-21 (spec 05 กฎ 45 + Q4): คำสงวน เทียบแบบไม่สนตัวพิมพ์; `r` ไม่อยู่ในรายการเพราะ regex บังคับ ≥ 3 ตัวอยู่แล้ว
// ข้อความคงที่ (storefront จับด้วยข้อความ — contract test ใน `affiliate-register-error.test.ts`) ไม่ต่อค่าจาก input
const RESERVED_CODES = new Set(["admin", "affiliate", "store", "auth", "api", "app", "www", "support", "shop"])
export const RESERVED_CODE_MESSAGE = "This referral code is reserved"

// code is the public slug in tracking links (`/r/<code>`); คง object schema เพราะ zodValidator ของ Medusa เรียก `.strict()`
export const PostAffiliateRegisterSchema = z.object({
  name: z.string().trim().min(1),
  code: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, "code must be a 3-32 char lowercase slug")
    .refine((code) => !RESERVED_CODES.has(code.toLowerCase()), RESERVED_CODE_MESSAGE),
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

// รายการของ portal (programs, payouts): limit/offset แบบ Medusa จำกัด limit ไม่เกิน 100
export const GetAffiliateListSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
export type GetAffiliateListSchemaType = z.infer<typeof GetAffiliateListSchema>
