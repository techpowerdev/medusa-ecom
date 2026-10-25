import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

const id = z.string().min(1)

const ProgramScope = z
  .object({
    all: z.boolean().optional(),
    variant_ids: z.array(id).optional(),
    collection_ids: z.array(id).optional(),
    category_ids: z.array(id).optional(),
  })
  .strict()

const programFields = {
  name: z.string().trim().min(1),
  starts_at: z.coerce.date(),
  ends_at: z.coerce.date(),
  announce_text: z.string().nullish(),
  commission_value: z.number().positive().max(100),
  scope: ProgramScope,
  attribution_window_days: z.number().int().min(1).optional(),
  cap_per_order: z.number().positive().nullish(),
  hold_days: z.number().int().min(0).optional(),
}

// Window is [starts_at, ends_at) (rule 10); "ended" is reached through an update only
export const AdminCreateAffiliateProgram = z
  .object({ ...programFields, status: z.enum(["draft", "published"]).optional() })
  .strict()
  .refine((p) => p.starts_at < p.ends_at, {
    message: "ends_at must be after starts_at",
    path: ["ends_at"],
  })
export type AdminCreateAffiliateProgram = z.infer<typeof AdminCreateAffiliateProgram>

export const AdminUpdateAffiliateProgram = z
  .object({ ...programFields, status: z.enum(["draft", "published", "ended"]) })
  .partial()
  .strict()
export type AdminUpdateAffiliateProgram = z.infer<typeof AdminUpdateAffiliateProgram>

export const AdminListAffiliatePrograms = createFindParams().extend({
  status: z.enum(["draft", "published", "ended"]).optional(),
})

export const AdminGetAffiliateParams = createFindParams()

export const AdminListAffiliates = createFindParams().extend({
  status: z.enum(["pending", "active", "suspended"]).optional(),
})

export const AdminUpdateAffiliate = z
  .object({
    status: z.enum(["pending", "active", "suspended"]).optional(),
    payout_info: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict()
export type AdminUpdateAffiliate = z.infer<typeof AdminUpdateAffiliate>

export const AdminListCommissionEntries = createFindParams().extend({
  affiliate_id: id.optional(),
  program_id: id.optional(),
  order_id: id.optional(),
  status: z.enum(["pending", "approved", "reversed", "paid"]).optional(),
})

export const AdminListPayouts = createFindParams().extend({
  affiliate_id: id.optional(),
  status: z.enum(["draft", "paid"]).optional(),
})

export const AdminCreatePayout = z
  .object({
    affiliate_id: id,
    period_from: z.coerce.date(),
    period_to: z.coerce.date(),
  })
  .strict()
  .refine((p) => p.period_from < p.period_to, {
    message: "period_to must be after period_from",
    path: ["period_to"],
  })
export type AdminCreatePayout = z.infer<typeof AdminCreatePayout>

export const AdminMarkPayoutPaid = z.object({ reference: z.string().trim().min(1).optional() }).strict()
export type AdminMarkPayoutPaid = z.infer<typeof AdminMarkPayoutPaid>

export const AdminAffiliateSummaryParams = z.object({
  affiliate_id: id.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
export type AdminAffiliateSummaryParams = z.infer<typeof AdminAffiliateSummaryParams>
