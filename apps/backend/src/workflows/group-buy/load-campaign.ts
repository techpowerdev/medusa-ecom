import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { GroupBuyCampaignStatus } from "../../modules/group_buy/utils/campaign-status"
import type { ScopeRule } from "../../modules/group_buy/utils/single-product"

export type LoadedGroupBuyCampaign = {
  id: string
  status: GroupBuyCampaignStatus
  campaign?: { id: string; ends_at?: string | Date | null } | null
  promotion?: {
    id: string
    application_method?: { id: string; target_rules?: ScopeRule[] | null } | null
  } | null
}

// อ่านแคมเปญพร้อม Medusa campaign + promotion ต้นแบบ (link template, ADR-011) ผ่าน Query
export async function loadGroupBuyCampaign(
  container: MedusaContainer,
  id: string
): Promise<LoadedGroupBuyCampaign> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "group_buy_campaign",
    fields: [
      "id",
      "status",
      "campaign.id",
      "campaign.ends_at",
      "promotion.id",
      "promotion.application_method.id",
      "promotion.application_method.target_rules.attribute",
      "promotion.application_method.target_rules.operator",
      "promotion.application_method.target_rules.values.value",
    ],
    filters: { id },
  })
  if (!data[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Group buy campaign with id: ${id} was not found`)
  }
  return data[0] as LoadedGroupBuyCampaign
}
