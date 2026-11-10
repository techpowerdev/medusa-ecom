import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { voidEvoucherCodeWorkflow } from "../../../../../../workflows/evoucher/void-evoucher-codes"
import { AdminVoidEvoucherCode } from "../../../validators"

// AC-10: void code `available` พร้อมเหตุผล → inventory ของ variant −1; code สถานะอื่น → 409
export async function POST(
  req: AuthenticatedMedusaRequest<AdminVoidEvoucherCode>,
  res: MedusaResponse
) {
  // code ที่ไม่ใช่ `available` → workflow throw CONFLICT + EVOUCHER_CODE_NOT_AVAILABLE → 409 ผ่าน errorHandler กลาง (PROMO-2)
  await voidEvoucherCodeWorkflow(req.scope).run({
    input: { code_id: req.params.id, reason: req.validatedBody.reason },
  })

  // ไม่คืน code/pin (ciphertext) — ดูค่าจริงได้ที่ /reveal เท่านั้น (AC-8)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "evoucher_code",
    fields: ["id", "pool_id", "status", "void_reason", "expires_at", "batch_ref", "updated_at"],
    filters: { id: req.params.id },
  })
  res.json({ code: data[0] })
}
