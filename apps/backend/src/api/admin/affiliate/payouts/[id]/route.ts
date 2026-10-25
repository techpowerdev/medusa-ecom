import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refetchEntity } from "../../helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ payout: await refetchEntity("payout", req.params.id, req) })
}
