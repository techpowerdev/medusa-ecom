import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"
import {
  deleteAffiliateProgramWorkflow,
  updateAffiliateProgramWorkflow,
} from "../../../../../workflows/affiliate/affiliate-program"
import { AdminUpdateAffiliateProgram } from "../../validators"

const retrieve = (req: AuthenticatedMedusaRequest) =>
  refetchEntity({
    entity: "affiliate_program",
    idOrFilter: req.params.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
    options: { throwIfKeyNotFound: true },
  })

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ program: await retrieve(req) })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAffiliateProgram>,
  res: MedusaResponse
) {
  await updateAffiliateProgramWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ program: await retrieve(req) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteAffiliateProgramWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "affiliate_program", deleted: true })
}
