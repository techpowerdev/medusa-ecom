import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

// The affiliate email comes from the emailpass identity it logs in with, not the request body
export const getAuthIdentityEmailStep = createStep(
  "get-auth-identity-email",
  async (authIdentityId: string, { container }) => {
    const authModule = container.resolve(Modules.AUTH)
    const identity = await authModule.retrieveAuthIdentity(authIdentityId, {
      relations: ["provider_identities"],
    })
    const email = identity.provider_identities?.find((p) => p.provider === "emailpass")?.entity_id

    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Auth identity has no emailpass email")
    }

    return new StepResponse(email)
  }
)
