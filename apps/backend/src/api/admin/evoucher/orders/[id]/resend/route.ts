import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resendEvoucherEmailWorkflow } from "../../../../../../workflows/evoucher/resend-evoucher-email"

// EV-5b (AC-18, AC-28, AC-29): ส่งอีเมล e-voucher ซ้ำ — order ไม่มี code delivered/allocated → 400,
// resend ของ order เดียวกันซ้อนกัน → 409 EVOUCHER_RESEND_IN_PROGRESS; ไม่คืน code (ciphertext/plaintext)
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await resendEvoucherEmailWorkflow(req.scope).run({
    input: { order_id: req.params.id },
  })
  res.json({ order_id: req.params.id, code_count: result.code_count })
}
