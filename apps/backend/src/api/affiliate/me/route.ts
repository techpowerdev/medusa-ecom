import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refetchAffiliate } from "../helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ affiliate: await refetchAffiliate(req.auth_context.actor_id, req.scope) })
}
