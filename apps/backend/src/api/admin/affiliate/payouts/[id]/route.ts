import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"

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
