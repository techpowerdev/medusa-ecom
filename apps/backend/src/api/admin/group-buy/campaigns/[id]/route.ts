import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteGroupBuyCampaignWorkflow,
  updateGroupBuyCampaignWorkflow,
} from "../../../../../workflows/group-buy/campaign"
import { refetchGroupBuyCampaign } from "../../helpers"
import { AdminUpdateGroupBuyCampaign } from "../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ campaign: await refetchGroupBuyCampaign(req, req.params.id) })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateGroupBuyCampaign>,
  res: MedusaResponse
) {
  await updateGroupBuyCampaignWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ campaign: await refetchGroupBuyCampaign(req, req.params.id) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteGroupBuyCampaignWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "group_buy_campaign", deleted: true })
}
