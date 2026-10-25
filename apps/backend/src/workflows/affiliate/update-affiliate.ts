import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"

// Admin approves/suspends (Q1) and fills payout_info (Q5); email/code are not editable in v1
export type UpdateAffiliateInput = {
  id: string
  status?: "pending" | "active" | "suspended"
  payout_info?: Record<string, unknown> | null
}

export const updateAffiliateStep = createStep(
  "update-affiliate",
  async (input: UpdateAffiliateInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const { id, status, payout_info } = await service.retrieveAffiliate(input.id, {
      select: ["id", "status", "payout_info"],
    })
    const affiliate = await service.updateAffiliates(input)
    return new StepResponse(affiliate, { id, status, payout_info })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliates(previous)
  }
)

export const updateAffiliateWorkflow = createWorkflow(
  "update-affiliate",
  function (input: UpdateAffiliateInput) {
    return new WorkflowResponse(updateAffiliateStep(input))
  }
)
