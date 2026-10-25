import { z } from "@medusajs/framework/zod"

// code is the public slug in tracking links (`/r/<code>`)
export const PostAffiliateRegisterSchema = z.object({
  name: z.string().trim().min(1),
  code: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, "code must be a 3-32 char lowercase slug"),
})

export type PostAffiliateRegisterSchemaType = z.infer<typeof PostAffiliateRegisterSchema>
