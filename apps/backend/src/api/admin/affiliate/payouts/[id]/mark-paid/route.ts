import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"
import { markAffiliatePayoutPaidWorkflow } from "../../../../../../workflows/affiliate/affiliate-payout"
import { AdminMarkPayoutPaid } from "../../../validators"

// Manual bank transfer done by admin (spec 05) → payout paid, its approved entries → paid
export async function POST(
  req: AuthenticatedMedusaRequest<AdminMarkPayoutPaid>,
  res: MedusaResponse
) {
  await markAffiliatePayoutPaidWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  const payout = await refetchEntity({
    entity: "affiliate_payout",
    idOrFilter: req.params.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
  })
  res.json({ payout })
}
