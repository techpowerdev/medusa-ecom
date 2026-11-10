import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  refetchEntities,
  refetchEntity,
} from "@medusajs/framework/http"
import { createAffiliatePayoutWorkflow } from "../../../../workflows/affiliate/affiliate-payout"
import { AdminCreatePayout } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data: payouts, metadata } = await refetchEntities({
    entity: "affiliate_payout",
    idOrFilter: req.filterableFields,
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({ payouts, count: metadata.count, limit: metadata.take, offset: metadata.skip })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminCreatePayout>, res: MedusaResponse) {
  const { result } = await createAffiliatePayoutWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  const payout = await refetchEntity({
    entity: "affiliate_payout",
    idOrFilter: result.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
  })
  res.json({ payout })
}
