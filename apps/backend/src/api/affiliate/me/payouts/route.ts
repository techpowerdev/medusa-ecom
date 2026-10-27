import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GetAffiliateListSchemaType } from "../../validators"

const PAYOUT_FIELDS = [
  "id",
  "affiliate_id",
  "amount",
  "currency",
  "period_from",
  "period_to",
  "status",
  "paid_at",
  "reference",
  "created_at",
]

// payout ของตัวเองเท่านั้น (อ่านอย่างเดียว; Q6) ใหม่สุดก่อน
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAffiliateListSchemaType>,
  res: MedusaResponse
) {
  const { limit, offset } = req.validatedQuery
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payouts, metadata } = await query.graph({
    entity: "affiliate_payout",
    fields: PAYOUT_FIELDS,
    filters: { affiliate_id: req.auth_context.actor_id },
    pagination: { skip: offset, take: limit, order: { created_at: "DESC", id: "DESC" } },
  })

  res.json({ payouts, count: metadata?.count ?? 0, limit, offset })
}
