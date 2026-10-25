import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  deleteEvoucherPartnerWorkflow,
  updateEvoucherPartnerWorkflow,
} from "../../../../../workflows/evoucher/evoucher-partner"
import { AdminUpdateEvoucherPartner } from "../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "evoucher_partner",
    filters: { id: req.params.id },
    ...req.queryConfig,
  })
  if (!data[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Evoucher partner not found")
  }
  res.json({ partner: data[0] })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateEvoucherPartner>,
  res: MedusaResponse
) {
  const { result } = await updateEvoucherPartnerWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ partner: result })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteEvoucherPartnerWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ id: req.params.id, object: "evoucher_partner", deleted: true })
}
