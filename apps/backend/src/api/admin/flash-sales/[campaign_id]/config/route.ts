import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { promotionsMissingExclusivityRule } from "../../../../../lib/flash-sale-exclusivity"
import {
  CAMPAIGN_PROMOTION_FIELDS,
  upsertFlashSaleConfigWorkflow,
} from "../../../../../workflows/flash-sale/upsert-flash-sale-config"
import type { AdminUpsertFlashSaleConfig } from "../../validators"

const CONFIG_FIELDS = [
  "id",
  "campaign_id",
  "per_customer_limit",
  "total_cap",
  "units_sold",
  "show_countdown",
  "show_remaining",
  "banner_text",
]

// response เดียวกันทั้ง GET/POST: config (null ถ้ายังไม่บันทึก) + automatic promotion ที่ยังไม่มี rule (กฎข้อ 7)
async function loadFlashSaleConfig(scope: MedusaContainer, campaignId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: campaigns } = await query.graph(
    { entity: "campaign", fields: CAMPAIGN_PROMOTION_FIELDS, filters: { id: campaignId } },
    { throwIfKeyNotFound: true }
  )
  const { data: configs } = await query.graph({
    entity: "flash_sale_config",
    fields: CONFIG_FIELDS,
    filters: { campaign_id: campaignId },
  })
  return {
    flash_sale_config: configs[0] ?? null,
    promotions_missing_exclusivity: promotionsMissingExclusivityRule(campaigns[0].promotions).map(
      (p) => ({ id: p.id, code: p.code })
    ),
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await loadFlashSaleConfig(req.scope, req.params.campaign_id))
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpsertFlashSaleConfig>,
  res: MedusaResponse
) {
  await upsertFlashSaleConfigWorkflow(req.scope).run({
    input: { ...req.validatedBody, campaign_id: req.params.campaign_id },
  })
  res.json(await loadFlashSaleConfig(req.scope, req.params.campaign_id))
}
