import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"
import { updateAffiliateWorkflow } from "../../../../../workflows/affiliate/update-affiliate"
import { AdminUpdateAffiliate } from "../../validators"

// Admin view includes payout_info (rule 8: only the portal hides it)
const retrieve = (req: AuthenticatedMedusaRequest) =>
  refetchEntity({
    entity: "affiliate",
    idOrFilter: req.params.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
    options: { throwIfKeyNotFound: true },
  })

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ affiliate: await retrieve(req) })
}

// Approve (status=active) / suspend / set payout_info (Q1, Q5)
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAffiliate>,
  res: MedusaResponse
) {
  await updateAffiliateWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ affiliate: await retrieve(req) })
}
