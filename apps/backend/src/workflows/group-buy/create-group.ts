import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createPromotionsWorkflow, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import type { GroupBuyCampaignStatus } from "../../modules/group_buy/utils/campaign-status"
import { assertGroupCreatable } from "../../modules/group_buy/utils/group-creation"
import { computeGroupEndsAt } from "../../modules/group_buy/utils/group-deadline"
import {
  buildGroupPromotionInput,
  generateJoinToken,
  type TemplatePromotion,
} from "../../modules/group_buy/utils/group-promotion"

export type CreateGroupInput = {
  campaign_id: string
  kind: "pool" | "team"
  customer_id?: string | null
  name?: string | null
}

type CampaignForGroup = {
  id: string
  status: GroupBuyCampaignStatus
  group_mode: "pool" | "team" | "both"
  team_duration_hours: number | null
  campaign?: { starts_at?: string | Date | null; ends_at?: string | Date | null } | null
  promotion?: TemplatePromotion | null
}

const TEMPLATE_FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "is_tax_inclusive",
  "campaign_id",
  "application_method.type",
  "application_method.target_type",
  "application_method.allocation",
  "application_method.value",
  "application_method.currency_code",
  "application_method.max_quantity",
  "application_method.target_rules.attribute",
  "application_method.target_rules.operator",
  "application_method.target_rules.values.value",
  "rules.attribute",
  "rules.operator",
  "rules.values.value",
]

const toDate = (value?: string | Date | null) => (value ? new Date(value) : null)

// spec 04 createGroupWorkflow ขั้น 1–3: โหลดแคมเปญ + Medusa campaign + ต้นแบบ, ตรวจสถานะ/ช่วงเวลา/mode,
// สร้าง join_token และ ends_at (คำนวณครั้งเดียว — กฎข้อ 2) ไม่เขียนอะไรจึงไม่มี compensation
export const prepareGroupBuyGroupStep = createStep(
  "prepare-group-buy-group",
  async (input: CreateGroupInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "group_buy_campaign",
      fields: [
        "id",
        "status",
        "group_mode",
        "team_duration_hours",
        "campaign.starts_at",
        "campaign.ends_at",
        ...TEMPLATE_FIELDS.map((f) => `promotion.${f}`),
      ],
      filters: { id: input.campaign_id },
    })
    const campaign = data[0] as unknown as CampaignForGroup | undefined
    if (!campaign) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Group buy campaign with id: ${input.campaign_id} was not found`
      )
    }

    const now = new Date()
    const endsAt = toDate(campaign.campaign?.ends_at)
    assertGroupCreatable({
      campaignStatus: campaign.status,
      startsAt: toDate(campaign.campaign?.starts_at),
      endsAt,
      now,
      groupMode: campaign.group_mode,
      kind: input.kind,
      customerId: input.customer_id,
    })
    // แคมเปญ active ผ่านการตรวจต้นแบบตอน activate แล้ว (GB-2a) — กันไว้กรณี link ถูกลบภายหลัง
    if (!campaign.promotion?.application_method) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The campaign has no template promotion with an application method"
      )
    }

    const token = generateJoinToken()
    return new StepResponse({
      promotion: buildGroupPromotionInput(campaign.promotion, token),
      group: {
        campaign_id: campaign.id,
        kind: input.kind,
        name: input.name ?? null,
        created_by_customer_id: input.kind === "team" ? input.customer_id ?? null : null,
        join_token: token,
        starts_at: now,
        ends_at: computeGroupEndsAt({
          kind: input.kind,
          createdAt: now,
          // assertGroupCreatable รับประกันว่ามี ends_at
          campaignEndsAt: endsAt as Date,
          teamDurationHours: campaign.team_duration_hours,
        }),
      },
    })
  }
)

type NewGroup = {
  campaign_id: string
  kind: "pool" | "team"
  name: string | null
  created_by_customer_id: string | null
  join_token: string
  starts_at: Date
  ends_at: Date
}

export const createGroupBuyGroupStep = createStep(
  "create-group-buy-group",
  async (input: NewGroup, { container }) => {
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const group = await service.createGroupBuyGroups(input)
    return new StepResponse(group, group.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    await service.deleteGroupBuyGroups(id)
  }
)

// spec 04 createGroupWorkflow + ADR-011 ข้อ 2: ตรวจ → clone ต้นแบบเป็น GB-<token> (active) → สร้างกลุ่ม → link
// "pool สร้างจาก admin เท่านั้น" บังคับที่ระดับ route (กฎใน spec) ไม่ใช่ที่นี่
export const createGroupWorkflow = createWorkflow(
  "create-group",
  function (input: CreateGroupInput) {
    const prepared = prepareGroupBuyGroupStep(input)

    // compensation ของ createPromotionsWorkflow = ลบ promotion
    const promotions = createPromotionsWorkflow.runAsStep({
      input: transform({ prepared }, ({ prepared }) => ({ promotionsData: [prepared.promotion] })),
    })

    const group = createGroupBuyGroupStep(transform({ prepared }, ({ prepared }) => prepared.group))

    createRemoteLinkStep(
      transform({ group, promotions }, ({ group, promotions }) => [
        {
          [GROUP_BUY_MODULE]: { group_buy_group_id: group.id },
          [Modules.PROMOTION]: { promotion_id: promotions[0].id },
        },
      ])
    )

    return new WorkflowResponse(
      transform({ group, promotions }, ({ group, promotions }) => ({
        ...group,
        promotion_id: promotions[0].id,
        promotion_code: promotions[0].code,
      }))
    )
  }
)
