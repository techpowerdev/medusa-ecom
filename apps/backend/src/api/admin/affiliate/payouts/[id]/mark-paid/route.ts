import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { markAffiliatePayoutPaidWorkflow } from "../../../../../../workflows/affiliate/affiliate-payout"
import { refetchEntity } from "../../../helpers"
import { AdminMarkPayoutPaid } from "../../../validators"

// Manual bank transfer done by admin (spec 05) → payout paid, its approved entries → paid
export async function POST(
  req: AuthenticatedMedusaRequest<AdminMarkPayoutPaid>,
  res: MedusaResponse
) {
  await markAffiliatePayoutPaidWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ payout: await refetchEntity("payout", req.params.id, req) })
}
