import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  refetchEntities,
  refetchEntity,
} from "@medusajs/framework/http"
import { createGroupWorkflow } from "../../../../../../workflows/group-buy/create-group"
import { AdminCreateGroupBuyGroup } from "../../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data, metadata } = await refetchEntities({
    entity: "group_buy_group",
    idOrFilter: { ...req.filterableFields, campaign_id: req.params.id },
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({ groups: data, count: metadata.count, limit: metadata.take, offset: metadata.skip })
}

// spec 04: admin สร้างได้เฉพาะ pool (kind ไม่รับจาก body); team สร้างผ่าน store route (GB-3)
export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateGroupBuyGroup>,
  res: MedusaResponse
) {
  const { result } = await createGroupWorkflow(req.scope).run({
    input: { campaign_id: req.params.id, kind: "pool", name: req.validatedBody.name },
  })
  const group = await refetchEntity({
    entity: "group_buy_group",
    idOrFilter: result.id,
    scope: req.scope,
    fields: req.queryConfig.fields,
    options: { throwIfKeyNotFound: true },
  })
  res.status(201).json({ group })
}
