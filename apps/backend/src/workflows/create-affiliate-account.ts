import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createAffiliateStep } from "./steps/create-affiliate"
import { getAuthIdentityEmailStep } from "./steps/get-auth-identity-email"

export type CreateAffiliateAccountInput = {
  authIdentityId: string
  name: string
  code: string
}

// Medusa "custom actor type" pattern: create the actor, then set app_metadata.affiliate_id
export const createAffiliateAccountWorkflow = createWorkflow(
  "create-affiliate-account",
  function (input: CreateAffiliateAccountInput) {
    const email = getAuthIdentityEmailStep(input.authIdentityId)

    const affiliateData = transform({ input, email }, ({ input, email }) => ({
      email,
      name: input.name,
      code: input.code,
    }))
    const affiliate = createAffiliateStep(affiliateData)

    setAuthAppMetadataStep({
      authIdentityId: input.authIdentityId,
      actorType: "affiliate",
      value: affiliate.id,
    })

    return new WorkflowResponse(affiliate)
  }
)
