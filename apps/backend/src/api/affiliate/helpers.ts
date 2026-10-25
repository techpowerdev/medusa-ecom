import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// payout_info is never exposed on the portal API (spec 05 rule 8)
export const AFFILIATE_PORTAL_FIELDS = ["id", "email", "name", "code", "status", "created_at"]

export const refetchAffiliate = async (id: string, scope: MedusaContainer) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [affiliate],
  } = await query.graph(
    { entity: "affiliate", fields: AFFILIATE_PORTAL_FIELDS, filters: { id } },
    { throwIfKeyNotFound: true }
  )

  return affiliate
}
