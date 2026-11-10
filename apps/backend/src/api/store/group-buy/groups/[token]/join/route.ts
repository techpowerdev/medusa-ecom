import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { joinGroupWorkflow } from "../../../../../../workflows/group-buy/join-group"
import type { StoreJoinGroupBuyGroup } from "../../../validators"

// spec 04 joinGroupWorkflow — 409 ของข้อจำกัดตอบผ่าน errorHandler กลาง (PROMO-2) ไม่แปลงที่นี่
export async function POST(
  req: AuthenticatedMedusaRequest<StoreJoinGroupBuyGroup>,
  res: MedusaResponse
) {
  const { result: membership } = await joinGroupWorkflow(req.scope).run({
    input: {
      join_token: req.params.token,
      cart_id: req.validatedBody.cart_id,
      customer_id: req.auth_context.actor_id,
    },
  })
  res.status(201).json({ membership })
}
