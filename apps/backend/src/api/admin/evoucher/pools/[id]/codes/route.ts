import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../../../../modules/evoucher"
import EvoucherModuleService from "../../../../../../modules/evoucher/service"
import { maskSecret } from "../../../../../../modules/evoucher/utils/mask"
import { AdminListEvoucherCodesParams } from "../../../validators"

// AC-8: คืน code แบบ masked เท่านั้น; ค่าจริงดูได้ที่ GET /admin/evoucher/codes/:id/reveal (มี audit)
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListEvoucherCodesParams>,
  res: MedusaResponse
) {
  const { status, limit, offset } = req.validatedQuery
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service: EvoucherModuleService = req.scope.resolve(EVOUCHER_MODULE)

  const { data, metadata } = await query.graph({
    entity: "evoucher_code",
    fields: [
      "id",
      "code",
      "pin",
      "status",
      "expires_at",
      "batch_ref",
      "order_id",
      "order_line_item_id",
      "customer_id",
      "allocated_at",
      "delivered_at",
      "delivered_to_email",
      "created_at",
    ],
    filters: { pool_id: req.params.id, ...(status ? { status } : {}) },
    pagination: { take: limit, skip: offset, order: { created_at: "ASC" } },
  })

  const codes = await Promise.all(
    data.map(async ({ code, pin, ...rest }) => ({
      ...rest,
      code: maskSecret(await service.decryptSecret(code)),
      has_pin: !!pin,
    }))
  )
  res.json({ codes, count: metadata?.count, limit, offset })
}
