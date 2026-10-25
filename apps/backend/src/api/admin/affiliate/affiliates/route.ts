import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listEntities } from "../helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await listEntities("affiliate", "affiliates", req, res)
}
