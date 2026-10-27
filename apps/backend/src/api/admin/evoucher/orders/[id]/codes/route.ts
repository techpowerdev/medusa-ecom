import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../../../../modules/evoucher"
import EvoucherModuleService from "../../../../../../modules/evoucher/service"
import { maskCodes } from "../../../helpers"

// EV-6: code ของ order สำหรับ widget หน้า order ใน admin — masked เสมอ (ค่าจริงต้องผ่าน reveal + audit)
// EV-9: หา code ผ่าน link order ↔ evoucher_code (src/links/order-evoucher-code.ts); order ไม่มีอยู่ → []
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service: EvoucherModuleService = req.scope.resolve(EVOUCHER_MODULE)

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "evoucher_codes.id",
      "evoucher_codes.code",
      "evoucher_codes.pin",
      "evoucher_codes.status",
      "evoucher_codes.expires_at",
      "evoucher_codes.order_line_item_id",
      "evoucher_codes.allocated_at",
      "evoucher_codes.delivered_at",
      "evoucher_codes.delivered_to_email",
      "evoucher_codes.created_at",
      "evoucher_codes.pool.id",
      "evoucher_codes.pool.name",
      "evoucher_codes.pool.partner.name",
    ],
    filters: { id: req.params.id },
  })

  // link ไม่รับ order ของ relation ฝั่ง evoucher_code จึงเรียงเอง (เดิม created_at ASC)
  const codes = (data[0]?.evoucher_codes ?? []).filter((code) => code != null).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  res.json({ codes: await maskCodes(service, codes) })
}
