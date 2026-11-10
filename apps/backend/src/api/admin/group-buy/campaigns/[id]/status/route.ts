import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setGroupBuyCampaignStatusWorkflow } from "../../../../../../workflows/group-buy/campaign-status"
import { refetchGroupBuyCampaign } from "../../../helpers"
import { AdminSetGroupBuyCampaignStatus } from "../../../validators"

// spec 04 กฎข้อ 10: draft → active → ended; ค่าเดิมซ้ำ = no-op 200; อย่างอื่น 400 not_allowed
export async function POST(
  req: AuthenticatedMedusaRequest<AdminSetGroupBuyCampaignStatus>,
  res: MedusaResponse
) {
  await setGroupBuyCampaignStatusWorkflow(req.scope).run({
    input: { id: req.params.id, status: req.validatedBody.status },
  })
  res.json({ campaign: await refetchGroupBuyCampaign(req, req.params.id) })
}
