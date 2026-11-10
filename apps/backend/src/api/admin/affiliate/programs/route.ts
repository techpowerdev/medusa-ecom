import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  refetchEntities,
  refetchEntity,
} from "@medusajs/framework/http"
import { createAffiliateProgramWorkflow } from "../../../../workflows/affiliate/affiliate-program"
import { AdminCreateAffiliateProgram } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data: programs, metadata } = await refetchEntities({
    entity: "affiliate_program",
    idOrFilter: req.filterableFields,
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({ programs, count: metadata.count, limit: metadata.take, offset: metadata.skip })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateAffiliateProgram>,
  res: MedusaResponse
) {
  const { result } = await createAffiliateProgramWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  const program = await refetchEntity({
    entity: "affiliate_program",
    idOrFilter: result.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
  })
  res.json({ program })
}
