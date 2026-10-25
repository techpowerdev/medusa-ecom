import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateAffiliateWorkflow } from "../../../../../workflows/affiliate/update-affiliate"
import { refetchEntity } from "../../helpers"
import { AdminUpdateAffiliate } from "../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ affiliate: await refetchEntity("affiliate", req.params.id, req) })
}

// Approve (status=active) / suspend / set payout_info (Q1, Q5)
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAffiliate>,
  res: MedusaResponse
) {
  await updateAffiliateWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ affiliate: await refetchEntity("affiliate", req.params.id, req) })
}
