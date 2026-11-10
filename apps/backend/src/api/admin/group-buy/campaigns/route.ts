import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  refetchEntities,
} from "@medusajs/framework/http"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../../../workflows/group-buy/campaign"
import { refetchGroupBuyCampaign, withTemplateId } from "../helpers"
import { AdminCreateGroupBuyCampaign } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data, metadata } = await refetchEntities({
    entity: "group_buy_campaign",
    idOrFilter: req.filterableFields,
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({
    campaigns: data.map(withTemplateId),
    count: metadata.count,
    limit: metadata.take,
    offset: metadata.skip,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateGroupBuyCampaign>,
  res: MedusaResponse
) {
  const { result } = await createGroupBuyCampaignWorkflow(req.scope).run({
    // validator ของ Medusa ยอม currency_code เป็น null แต่ DTO ไม่ระบุ — promotion module รับได้ทั้งคู่
    input: req.validatedBody as CreateGroupBuyCampaignInput,
  })
  res.json({ campaign: await refetchGroupBuyCampaign(req, result.id) })
}
