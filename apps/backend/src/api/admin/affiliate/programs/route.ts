import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createAffiliateProgramWorkflow } from "../../../../workflows/affiliate/affiliate-program"
import { listEntities, refetchEntity } from "../helpers"
import { AdminCreateAffiliateProgram } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await listEntities("program", "programs", req, res)
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateAffiliateProgram>,
  res: MedusaResponse
) {
  const { result } = await createAffiliateProgramWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ program: await refetchEntity("program", result.id, req) })
}
