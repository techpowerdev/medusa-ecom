import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntity } from "@medusajs/framework/http"
import { createGroupWorkflow } from "../../../../workflows/group-buy/create-group"
import type { StoreCreateGroupBuyGroup } from "../validators"

export const STORE_GROUP_FIELDS = [
  "id",
  "campaign_id",
  "kind",
  "name",
  "created_by_customer_id",
  "join_token",
  "starts_at",
  "ends_at",
  "status",
  "progress_orders",
  "progress_units",
  "progress_people",
]

// spec 04 (GB-3, AC-6): ลูกค้าสร้าง team เท่านั้น — kind=team เสมอ ("pool สร้างจาก admin เท่านั้น" บังคับที่ route)
export async function POST(
  req: AuthenticatedMedusaRequest<StoreCreateGroupBuyGroup>,
  res: MedusaResponse
) {
  const { result } = await createGroupWorkflow(req.scope).run({
    input: {
      campaign_id: req.validatedBody.campaign_id,
      kind: "team",
      customer_id: req.auth_context.actor_id,
      name: req.validatedBody.name,
    },
  })
  const group = await refetchEntity({
    entity: "group_buy_group",
    idOrFilter: result.id,
    scope: req.scope,
    fields: STORE_GROUP_FIELDS,
    options: { throwIfKeyNotFound: true },
  })
  res.status(201).json({ group })
}
