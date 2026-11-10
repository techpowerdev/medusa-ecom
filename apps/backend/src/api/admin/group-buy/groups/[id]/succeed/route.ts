import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { succeedGroupWorkflow } from "../../../../../../workflows/group-buy/group-outcome"
import { refetchGroupBuyGroup } from "../../../helpers"

// spec 04 (GB-4): admin override — succeed โดยไม่ดูเป้าหมาย; ซ้ำ = no-op 200; กลุ่ม failed → 400 not_allowed
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await succeedGroupWorkflow(req.scope).run({ input: { group_id: req.params.id } })
  res.json({ group: await refetchGroupBuyGroup(req, req.params.id) })
}
