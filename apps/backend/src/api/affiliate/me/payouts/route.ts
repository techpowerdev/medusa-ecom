import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payouts } = await query.graph({
    entity: "affiliate_payout",
    fields: PAYOUT_FIELDS,
    filters: { affiliate_id: req.auth_context.actor_id },
    pagination: { order: { created_at: "DESC", id: "DESC" } },
  })

  res.json({ payouts })
}
