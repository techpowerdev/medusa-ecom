import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FLASH_SALE_MODULE } from "../../../../../../modules/flash_sale"
import type FlashSaleModuleService from "../../../../../../modules/flash_sale/service"
import { customerAllowance } from "../../../../../../modules/flash_sale/utils/allowance"
import { getActiveFlashSalesWorkflow } from "../../../../../../workflows/flash-sale/get-active-flash-sales"
import type { StoreGetFlashSaleAllowanceParams } from "../../../../flash-sales/validators"

/**
 * FS-20 (spec 03 กฎข้อ 25, AC-27): สิทธิ์ flash ที่เหลือของลูกค้าผู้เรียก ต่อ variant ที่อยู่ในแคมเปญ flash active
 * - อ่านอย่างเดียว; auth ของ customer มาจาก middleware `/store/customers/me*` ของ Medusa
 * - variant ↔ campaign ให้ Promotion module ตัดสินผ่าน preview ของ FS-4 (ADR-003) จึงต้องมี `region_id`
 * - ค่านี้ไว้แสดง/เตือนก่อนจ่าย ด่านจริงคือ SQL atomic ของ `reserveForCart` ตอน complete (กฎข้อ 2)
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, StoreGetFlashSaleAllowanceParams>,
  res: MedusaResponse
) {
  const { region_id, variant_ids } = req.validatedQuery as StoreGetFlashSaleAllowanceParams
  const customerId = req.auth_context.actor_id

  const { result } = await getActiveFlashSalesWorkflow(req.scope).run({
    input: {
      region_id,
      variant_ids,
      sales_channel_ids: req.publishable_key_context?.sales_channel_ids ?? [],
    },
  })
  const inCampaign = result.variants.filter((v) => !!v.campaign_id)
  const campaignIds = [...new Set(inCampaign.map((v) => v.campaign_id!))]

  const flashSale: FlashSaleModuleService = req.scope.resolve(FLASH_SALE_MODULE)
  const [configs, usages] = campaignIds.length
    ? await Promise.all([
        flashSale.listFlashSaleConfigs(
          { campaign_id: campaignIds },
          { select: ["campaign_id", "per_customer_limit"] }
        ),
        flashSale.listFlashSaleUsages(
          { campaign_id: campaignIds, customer_id: customerId },
          { select: ["campaign_id", "units"] }
        ),
      ])
    : [[], []]
  const limitOf = new Map(configs.map((c) => [c.campaign_id, c.per_customer_limit]))
  const usageOf = new Map(usages.map((u) => [u.campaign_id, u]))

  res.setHeader("Cache-Control", "private, no-store")
  res.json({
    allowances: inCampaign.map((v) => ({
      variant_id: v.variant_id,
      campaign_id: v.campaign_id!,
      ...customerAllowance(limitOf.get(v.campaign_id!), usageOf.get(v.campaign_id!)),
    })),
  })
}
