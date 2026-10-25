import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../../../../modules/evoucher"
import EvoucherModuleService from "../../../../../../modules/evoucher/service"
import { maskCodes } from "../../../helpers"

// EV-6: code ของ order สำหรับ widget หน้า order ใน admin — masked เสมอ (ค่าจริงต้องผ่าน reveal + audit)
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service: EvoucherModuleService = req.scope.resolve(EVOUCHER_MODULE)

  const { data } = await query.graph({
    entity: "evoucher_code",
    fields: [
      "id",
      "code",
      "pin",
      "status",
      "expires_at",
      "order_line_item_id",
      "allocated_at",
      "delivered_at",
      "delivered_to_email",
      "pool.id",
      "pool.name",
      "pool.partner.name",
    ],
    filters: { order_id: req.params.id },
    pagination: { order: { created_at: "ASC" } },
  })

  res.json({ codes: await maskCodes(service, data) })
}
