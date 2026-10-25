import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const AdminListEvoucherParams = createFindParams()

// EV-6: variant widget หา pool ของ variant ด้วย ?variant_id=
export const AdminListEvoucherPoolParams = createFindParams().extend({
  variant_id: z.string().optional(),
})

export const AdminCreateEvoucherPartner = z.object({
  name: z.string().min(1),
  logo_url: z.url().nullish(),
  terms_url: z.url().nullish(),
  support_contact: z.string().nullish(),
})
export type AdminCreateEvoucherPartner = z.infer<typeof AdminCreateEvoucherPartner>

export const AdminUpdateEvoucherPartner = AdminCreateEvoucherPartner.partial()
export type AdminUpdateEvoucherPartner = z.infer<typeof AdminUpdateEvoucherPartner>

const poolFields = {
  partner_id: z.string(),
  name: z.string().min(1),
  how_to_use: z.string().min(1),
  face_value: z.number().nonnegative().nullish(),
  validity_note: z.string().nullish(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
}

export const AdminCreateEvoucherPool = z.object({
  ...poolFields,
  variant_id: z.string(),
})
export type AdminCreateEvoucherPool = z.infer<typeof AdminCreateEvoucherPool>

export const AdminUpdateEvoucherPool = z.object(poolFields).partial()
export type AdminUpdateEvoucherPool = z.infer<typeof AdminUpdateEvoucherPool>

export const AdminListEvoucherCodesParams = z.object({
  status: z.enum(["available", "allocated", "delivered", "void"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type AdminListEvoucherCodesParams = z.infer<typeof AdminListEvoucherCodesParams>
