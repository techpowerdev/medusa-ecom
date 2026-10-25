import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"

export type CreateAffiliateStepInput = {
  email: string
  name: string
  code: string
}

export const createAffiliateStep = createStep(
  "create-affiliate",
  async (input: CreateAffiliateStepInput, { container }) => {
    const affiliateModule: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const affiliate = await affiliateModule.createAffiliates(input)

    return new StepResponse(affiliate, affiliate.id)
  },
  async (affiliateId, { container }) => {
    if (!affiliateId) {
      return
    }
    const affiliateModule: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await affiliateModule.deleteAffiliates(affiliateId)
  }
)
