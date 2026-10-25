import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import {
  assertCampaignActivatable,
  type GroupBuyCampaignStatus,
  resolveCampaignStatusTransition,
} from "../../modules/group_buy/utils/campaign-status"
import { loadGroupBuyCampaign } from "./load-campaign"

export type SetGroupBuyCampaignStatusInput = { id: string; status: GroupBuyCampaignStatus }

// spec 04 กฎข้อ 10: draft → active (ต้องมีต้นแบบ + ends_at > now), active → ended; ค่าเดิมซ้ำ = no-op
export const setGroupBuyCampaignStatusStep = createStep(
  "set-group-buy-campaign-status",
  async ({ id, status }: SetGroupBuyCampaignStatusInput, { container }) => {
    const campaign = await loadGroupBuyCampaign(container, id)
    if (resolveCampaignStatusTransition(campaign.status, status) === "noop") {
      return new StepResponse({ id, status }, null)
    }
    if (status === "active") {
      assertCampaignActivatable({
        hasTemplateApplicationMethod: !!campaign.promotion?.application_method,
        endsAt: campaign.campaign?.ends_at ? new Date(campaign.campaign.ends_at) : null,
        now: new Date(),
      })
    }

    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    await service.updateGroupBuyCampaigns({ id, status })
    return new StepResponse({ id, status }, { id, status: campaign.status })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    await service.updateGroupBuyCampaigns(previous)
  }
)

export const setGroupBuyCampaignStatusWorkflow = createWorkflow(
  "set-group-buy-campaign-status",
  function (input: SetGroupBuyCampaignStatusInput) {
    return new WorkflowResponse(setGroupBuyCampaignStatusStep(input))
  }
)
