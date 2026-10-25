import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { FLASH_SALE_MODULE } from "../../modules/flash_sale"
import FlashSaleModuleService from "../../modules/flash_sale/service"
import { exclusiveAutomaticRule } from "../../lib/promotion-exclusivity"
import { promotionsMissingExclusivityRule } from "../../lib/flash-sale-exclusivity"

// FS-5: บันทึก flash config ของ campaign + ใส่ exclusivity rule ให้ automatic promotion ของ campaign (spec 03 กฎข้อ 7)
// units_sold ไม่ใช่ field ที่ admin แก้ได้ (FS-3 เป็นผู้นับ) และไม่มี check cap จึงลด total_cap ต่ำกว่า units_sold ได้ (กฎข้อ 12)
export type FlashSaleConfigFields = {
  per_customer_limit?: number | null
  total_cap?: number | null
  show_countdown?: boolean
  show_remaining?: boolean
  banner_text?: string | null
}

export type UpsertFlashSaleConfigInput = FlashSaleConfigFields & { campaign_id: string }

export const CAMPAIGN_PROMOTION_FIELDS = [
  "id",
  "promotions.id",
  "promotions.code",
  "promotions.is_automatic",
  "promotions.rules.attribute",
  "promotions.rules.operator",
  "promotions.rules.values.value",
]

const EDITABLE_FIELDS = [
  "per_customer_limit",
  "total_cap",
  "show_countdown",
  "show_remaining",
  "banner_text",
] as const

type Previous = { created_id?: string; restore?: FlashSaleConfigFields & { id: string } }

export const upsertFlashSaleConfigStep = createStep(
  "upsert-flash-sale-config",
  async (input: UpsertFlashSaleConfigInput, { container }) => {
    const service: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    const { campaign_id, ...fields } = input
    const [existing] = await service.listFlashSaleConfigs(
      { campaign_id },
      { select: ["id", ...EDITABLE_FIELDS] }
    )

    if (!existing) {
      const created = await service.createFlashSaleConfigs({ campaign_id, ...fields })
      return new StepResponse(created, { created_id: created.id } as Previous)
    }

    const restore = { id: existing.id } as FlashSaleConfigFields & { id: string }
    for (const key of EDITABLE_FIELDS) {
      ;(restore as Record<string, unknown>)[key] = existing[key]
    }
    const updated = await service.updateFlashSaleConfigs({ id: existing.id, ...fields })
    return new StepResponse(updated, { restore } as Previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    if (previous.created_id) {
      await service.deleteFlashSaleConfigs(previous.created_id)
    } else if (previous.restore) {
      // คืนเฉพาะ field ที่ admin แก้ — ไม่แตะ units_sold ที่ FS-3 อาจเปลี่ยนระหว่างนั้น
      await service.updateFlashSaleConfigs(previous.restore)
    }
  }
)

// เทียบเท่า addRulesToPromotionsStep ของ Medusa แต่รับหลาย promotion (ของ Medusa รับครั้งละตัว)
export const addFlashSaleExclusivityRulesStep = createStep(
  "add-flash-sale-exclusivity-rules",
  async (input: { promotion_ids: string[] }, { container }) => {
    const promotionModule = container.resolve(Modules.PROMOTION)
    const added: { id: string; rule_ids: string[] }[] = []
    for (const id of input.promotion_ids) {
      const rules = await promotionModule.addPromotionRules(id, [exclusiveAutomaticRule()])
      added.push({ id, rule_ids: rules.map((r) => r.id) })
    }
    return new StepResponse(
      added.map((a) => a.id),
      added
    )
  },
  async (added, { container }) => {
    if (!added?.length) {
      return
    }
    const promotionModule = container.resolve(Modules.PROMOTION)
    for (const { id, rule_ids } of added) {
      await promotionModule.removePromotionRules(id, rule_ids)
    }
  }
)

export const upsertFlashSaleConfigWorkflow = createWorkflow(
  "upsert-flash-sale-config",
  function (input: UpsertFlashSaleConfigInput) {
    const { data: campaigns } = useQueryGraphStep({
      entity: "campaign",
      fields: CAMPAIGN_PROMOTION_FIELDS,
      filters: { id: input.campaign_id },
      options: { throwIfKeyNotFound: true },
    })

    // idempotent: ใส่เฉพาะตัวที่ยังไม่มี rule
    const promotionIds = transform({ campaigns }, ({ campaigns }) =>
      promotionsMissingExclusivityRule(campaigns[0]?.promotions ?? []).map((p) => p.id)
    )

    const config = upsertFlashSaleConfigStep(input)
    addFlashSaleExclusivityRulesStep({ promotion_ids: promotionIds })

    return new WorkflowResponse(config)
  }
)
