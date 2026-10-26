import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"
import { cancelAffiliatePayoutWorkflow } from "../../../../../workflows/affiliate/affiliate-payout"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const payout = await refetchEntity({
    entity: "affiliate_payout",
    idOrFilter: req.params.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
    options: { throwIfKeyNotFound: true },
  })
  res.json({ payout })
}

// AF-9: cancel a draft payout (soft-delete, Q9); paid → 400 NOT_ALLOWED
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await cancelAffiliatePayoutWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "affiliate_payout", deleted: true })
}
