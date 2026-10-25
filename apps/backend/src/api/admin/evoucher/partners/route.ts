import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createEvoucherPartnerWorkflow } from "../../../../workflows/evoucher/evoucher-partner"
import { AdminCreateEvoucherPartner } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: partners, metadata } = await query.graph({
    entity: "evoucher_partner",
    ...req.queryConfig,
  })
  res.json({
    partners,
    count: metadata?.count,
    limit: metadata?.take,
    offset: metadata?.skip,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateEvoucherPartner>,
  res: MedusaResponse
) {
  const { result } = await createEvoucherPartnerWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ partner: result })
}
