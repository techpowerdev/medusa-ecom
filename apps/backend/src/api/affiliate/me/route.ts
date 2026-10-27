import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { hasPayoutInfo, refetchAffiliate } from "../helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const id = req.auth_context.actor_id
  const affiliate = await refetchAffiliate(id, req.scope)

  // payout_info อ่านเพื่อคำนวณ boolean เท่านั้น ไม่ส่งออก (กฎ 8, 34)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [{ payout_info }],
  } = await query.graph(
    { entity: "affiliate", fields: ["payout_info"], filters: { id } },
    { throwIfKeyNotFound: true }
  )

  res.json({ affiliate: { ...affiliate, has_payout_info: hasPayoutInfo(payout_info) } })
}
