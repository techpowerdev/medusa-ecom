import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createAffiliateAccountWorkflow } from "../../../workflows/create-affiliate-account"
import { refetchAffiliate } from "../helpers"
import { PostAffiliateRegisterSchemaType } from "../validators"

// Called with the token from /auth/affiliate/emailpass/register (or login without an affiliate yet)
export async function POST(
  req: AuthenticatedMedusaRequest<PostAffiliateRegisterSchemaType>,
  res: MedusaResponse
) {
  // Same guard as Medusa's POST /store/customers
  if (req.auth_context.actor_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Request already authenticated as an affiliate."
    )
  }

  const { result } = await createAffiliateAccountWorkflow(req.scope).run({
    input: { authIdentityId: req.auth_context.auth_identity_id, ...req.validatedBody },
  })

  res.json({ affiliate: await refetchAffiliate(result.id, req.scope) })
}
