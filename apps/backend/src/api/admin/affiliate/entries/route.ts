import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listEntities } from "../helpers"

// Ledger is read-only through the API (rule 5)
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await listEntities("entry", "entries", req, res)
}
