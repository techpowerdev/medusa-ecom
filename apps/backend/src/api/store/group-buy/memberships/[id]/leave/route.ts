import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leaveGroupWorkflow } from "../../../../../../workflows/group-buy/leave-group"

// spec 04 กฎข้อ 13 — membership ของคนอื่น/ไม่พบ → 404 (ADR-013), cancelled แล้ว/กลุ่มไม่ open → 400
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result: membership } = await leaveGroupWorkflow(req.scope).run({
    input: { membership_id: req.params.id, customer_id: req.auth_context.actor_id },
  })
  res.json({ membership })
}
