import { AuthenticatedMedusaRequest, MedusaNextFunction, MedusaResponse } from "@medusajs/framework/http"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

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

type AffiliateStatus = "pending" | "active" | "suspended"

/** Q6: สิทธิ์ตามสถานะ affiliate — รันหลัง authenticate("affiliate") สถานะอื่น → 403 */
export const requireAffiliateStatus =
  (...allowed: AffiliateStatus[]) =>
  async (req: AuthenticatedMedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    const { status } = await refetchAffiliate(req.auth_context.actor_id, req.scope)
    if (!allowed.includes(status)) {
      return next(new MedusaError(MedusaError.Types.FORBIDDEN, `Affiliate status "${status}" cannot access this route`))
    }
    next()
  }

// field ของโปรแกรมที่ affiliate เห็น (ไม่ส่ง scope ภายใน)
export const PORTAL_PROGRAM_FIELDS = [
  "id",
  "name",
  "starts_at",
  "ends_at",
  "announce_text",
  "commission_type",
  "commission_value",
  "attribution_window_days",
  "cap_per_order",
  "hold_days",
]
