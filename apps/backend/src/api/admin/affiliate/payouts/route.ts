import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createAffiliatePayoutWorkflow } from "../../../../workflows/affiliate/affiliate-payout"
import { listEntities, refetchEntity } from "../helpers"
import { AdminCreatePayout } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await listEntities("payout", "payouts", req, res)
}

export async function POST(req: AuthenticatedMedusaRequest<AdminCreatePayout>, res: MedusaResponse) {
  const { result } = await createAffiliatePayoutWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ payout: await refetchEntity("payout", result.id, req) })
}
