import { randomUUID } from "crypto"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type {
  CreateApplicationMethodDTO,
  CreatePromotionRuleDTO,
  LinkDefinition,
} from "@medusajs/framework/types"
import {
  createCampaignsWorkflow,
  createPromotionsWorkflow,
  createRemoteLinkStep,
  deleteCampaignsWorkflow,
  deletePromotionsWorkflow,
  dismissRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import { assertCampaignPatchAllowed } from "../../modules/group_buy/utils/campaign-status"
import { generateTemplateCode } from "../../modules/group_buy/utils/template-code"
import { loadGroupBuyCampaign } from "./load-campaign"

// คอนฟิกที่เก็บใน GroupBuyCampaign; ส่วนลด/scope อยู่ที่ promotion ต้นแบบ, ช่วงเวลาอยู่ที่ Medusa campaign (ADR-011)
export type GroupBuyCampaignConfig = {
  name: string
  target_type: "orders" | "units" | "people"
  target_value: number
  max_total_orders?: number | null
  max_units_per_person?: number | null
  max_people_per_group?: number | null
  group_mode: "pool" | "team" | "both"
  team_duration_hours?: number | null
  pay_within_hours?: number
}

export type CreateGroupBuyCampaignInput = GroupBuyCampaignConfig & {
  starts_at?: Date | string | null
  ends_at: Date | string
  application_method: CreateApplicationMethodDTO
  rules?: CreatePromotionRuleDTO[]
  is_tax_inclusive?: boolean
}

export type UpdateGroupBuyCampaignInput = Partial<GroupBuyCampaignConfig> & { id: string }

const CONFIG_FIELDS = [
  "name",
  "target_type",
  "target_value",
  "max_total_orders",
  "max_units_per_person",
  "max_people_per_group",
  "group_mode",
  "team_duration_hours",
  "pay_within_hours",
] as const

const groupBuyService = (container: { resolve: <T>(key: string) => T }) =>
  container.resolve<GroupBuyModuleService>(GROUP_BUY_MODULE)

export const createGroupBuyCampaignStep = createStep(
  "create-group-buy-campaign",
  async (input: GroupBuyCampaignConfig, { container }) => {
    const campaign = await groupBuyService(container).createGroupBuyCampaigns(input)
    return new StepResponse(campaign, campaign.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    await groupBuyService(container).deleteGroupBuyCampaigns(id)
  }
)

// spec 04 updateGroupBuyCampaignWorkflow: draft แก้ได้ทุกคอนฟิก; active เฉพาะ name/pay_within_hours; ended ไม่ได้
export const updateGroupBuyCampaignStep = createStep(
  "update-group-buy-campaign",
  async ({ id, ...patch }: UpdateGroupBuyCampaignInput, { container }) => {
    const service = groupBuyService(container)
    const previous = await service.retrieveGroupBuyCampaign(id, {
      select: ["id", "status", ...CONFIG_FIELDS],
    })
    assertCampaignPatchAllowed(previous.status, patch)

    const campaign = await service.updateGroupBuyCampaigns({ id, ...patch })
    const restore = Object.fromEntries(Object.keys(patch).map((key) => [key, previous[key]]))
    return new StepResponse(campaign, { id, ...restore })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    await groupBuyService(container).updateGroupBuyCampaigns(previous)
  }
)

// spec 04 deleteGroupBuyCampaignWorkflow ขั้น 1: ลบได้เฉพาะ draft (แคมเปญ draft ไม่มีกลุ่ม)
export const loadDeletableGroupBuyCampaignStep = createStep(
  "load-deletable-group-buy-campaign",
  async ({ id }: { id: string }, { container }) => {
    const campaign = await loadGroupBuyCampaign(container, id)
    if (campaign.status !== "draft") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Only draft group buy campaigns can be deleted (status: ${campaign.status})`
      )
    }
    return new StepResponse({
      id,
      promotion_campaign_id: campaign.campaign?.id ?? null,
      template_promotion_id: campaign.promotion?.id ?? null,
    })
  }
)

export const softDeleteGroupBuyCampaignStep = createStep(
  "soft-delete-group-buy-campaign",
  async ({ id }: { id: string }, { container }) => {
    await groupBuyService(container).softDeleteGroupBuyCampaigns(id)
    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    await groupBuyService(container).restoreGroupBuyCampaigns(id)
  }
)

const campaignLinks = (
  id: string,
  promotionCampaignId: string | null,
  templatePromotionId: string | null
): LinkDefinition[] => [
  ...(promotionCampaignId
    ? [
        {
          [GROUP_BUY_MODULE]: { group_buy_campaign_id: id },
          [Modules.PROMOTION]: { campaign_id: promotionCampaignId },
        },
      ]
    : []),
  ...(templatePromotionId
    ? [
        {
          [GROUP_BUY_MODULE]: { group_buy_campaign_id: id },
          [Modules.PROMOTION]: { promotion_id: templatePromotionId },
        },
      ]
    : []),
]

// spec 04 + ADR-011 ข้อ 1: Medusa campaign → promotion ต้นแบบ (draft, GBT-*) → GroupBuyCampaign (draft) → links
export const createGroupBuyCampaignWorkflow = createWorkflow(
  "create-group-buy-campaign",
  function (input: CreateGroupBuyCampaignInput) {
    const prepared = transform({ input }, ({ input }) => {
      const code = generateTemplateCode()
      const { starts_at, ends_at, application_method, rules, is_tax_inclusive, ...config } = input
      return {
        code,
        config,
        campaign: {
          name: input.name,
          // ไม่ใช้ code ต้นแบบซ้ำ — campaign_identifier แสดงในหน้า campaign ของ Medusa admin
          campaign_identifier: `group-buy-${randomUUID()}`,
          starts_at: starts_at ? new Date(starts_at) : null,
          ends_at: new Date(ends_at),
        },
        promotion: { application_method, rules, is_tax_inclusive },
      }
    })

    const promotionCampaigns = createCampaignsWorkflow.runAsStep({
      input: transform({ prepared }, ({ prepared }) => ({ campaignsData: [prepared.campaign] })),
    })

    const templates = createPromotionsWorkflow.runAsStep({
      input: transform({ prepared, promotionCampaigns }, ({ prepared, promotionCampaigns }) => ({
        promotionsData: [
          {
            ...prepared.promotion,
            code: prepared.code,
            type: "standard" as const,
            status: "draft" as const,
            is_automatic: false,
            campaign_id: promotionCampaigns[0].id,
          },
        ],
      })),
    })

    const campaign = createGroupBuyCampaignStep(prepared.config)

    createRemoteLinkStep(
      transform({ campaign, promotionCampaigns, templates }, (data) =>
        campaignLinks(data.campaign.id, data.promotionCampaigns[0].id, data.templates[0].id)
      )
    )

    return new WorkflowResponse(
      transform({ campaign, templates }, ({ campaign, templates }) => ({
        ...campaign,
        template_promotion_id: templates[0].id,
      }))
    )
  }
)

export const updateGroupBuyCampaignWorkflow = createWorkflow(
  "update-group-buy-campaign",
  function (input: UpdateGroupBuyCampaignInput) {
    return new WorkflowResponse(updateGroupBuyCampaignStep(input))
  }
)

// spec 04 deleteGroupBuyCampaignWorkflow: dismiss links → soft-delete → ลบต้นแบบ → ลบ Medusa campaign
export const deleteGroupBuyCampaignWorkflow = createWorkflow(
  "delete-group-buy-campaign",
  function (input: { id: string }) {
    const target = loadDeletableGroupBuyCampaignStep(input)

    dismissRemoteLinkStep(
      transform({ target }, ({ target }) =>
        campaignLinks(target.id, target.promotion_campaign_id, target.template_promotion_id)
      )
    )
    softDeleteGroupBuyCampaignStep(input)

    deletePromotionsWorkflow.runAsStep({
      input: transform({ target }, ({ target }) => ({
        ids: target.template_promotion_id ? [target.template_promotion_id] : [],
      })),
    })
    deleteCampaignsWorkflow.runAsStep({
      input: transform({ target }, ({ target }) => ({
        ids: target.promotion_campaign_id ? [target.promotion_campaign_id] : [],
      })),
    })

    return new WorkflowResponse(input.id)
  }
)
