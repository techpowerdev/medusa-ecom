import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { revealEvoucherCodeWorkflow } from "../../../../../../workflows/evoucher/reveal-evoucher-code"

// AC-8: endpoint เดียวที่คืนค่า code/PIN จริง — workflow เขียน audit ก่อนถอดรหัส
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await revealEvoucherCodeWorkflow(req.scope).run({
    input: {
      code_id: req.params.id,
      actor_type: req.auth_context.actor_type,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ code: result })
}
