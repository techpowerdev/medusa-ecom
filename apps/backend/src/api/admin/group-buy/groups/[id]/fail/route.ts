import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { failGroupWorkflow } from "../../../../../../workflows/group-buy/group-outcome"
import { refetchGroupBuyGroup } from "../../../helpers"

// spec 04 (GB-4): admin override — fail; ซ้ำ = no-op 200; กลุ่ม succeeded → 400 not_allowed
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await failGroupWorkflow(req.scope).run({ input: { group_id: req.params.id } })
  res.json({ group: await refetchGroupBuyGroup(req, req.params.id) })
}
