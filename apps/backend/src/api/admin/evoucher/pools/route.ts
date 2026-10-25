import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../../modules/evoucher"
import EvoucherModuleService from "../../../../modules/evoucher/service"
import { createEvoucherPoolWorkflow } from "../../../../workflows/evoucher/evoucher-pool"
import { withCodeCounts } from "../helpers"
import { AdminCreateEvoucherPool } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service: EvoucherModuleService = req.scope.resolve(EVOUCHER_MODULE)
  const { data, metadata } = await query.graph({
    entity: "evoucher_pool",
    filters: req.filterableFields,
    ...req.queryConfig,
  })
  res.json({
    pools: await withCodeCounts(service, data),
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
