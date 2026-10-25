import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  deleteEvoucherPoolWorkflow,
  updateEvoucherPoolWorkflow,
} from "../../../../../workflows/evoucher/evoucher-pool"
import { AdminUpdateEvoucherPool } from "../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "evoucher_pool",
    filters: { id: req.params.id },
    ...req.queryConfig,
  })
  if (!data[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Evoucher pool not found")
  }
  res.json({ pool: data[0] })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateEvoucherPool>,
  res: MedusaResponse
) {
  const { result } = await updateEvoucherPoolWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ pool: result })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteEvoucherPoolWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ id: req.params.id, object: "evoucher_pool", deleted: true })
}
