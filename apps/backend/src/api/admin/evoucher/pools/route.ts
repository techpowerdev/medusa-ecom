import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createEvoucherPoolWorkflow } from "../../../../workflows/evoucher/evoucher-pool"
import { AdminCreateEvoucherPool } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: pools, metadata } = await query.graph({
    entity: "evoucher_pool",
    ...req.queryConfig,
  })
  res.json({
    pools,
    count: metadata?.count,
    limit: metadata?.take,
    offset: metadata?.skip,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateEvoucherPool>,
  res: MedusaResponse
) {
  const { result } = await createEvoucherPoolWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ pool: result })
}
