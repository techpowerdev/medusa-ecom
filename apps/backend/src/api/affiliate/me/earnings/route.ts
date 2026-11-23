import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AFFILIATE_MODULE } from "../../../../modules/affiliate"
import AffiliateModuleService from "../../../../modules/affiliate/service"
import { GetAffiliateEarningsSchemaType } from "../../validators"

// ยอดรวมของ ledger ตัวเองต่อ currency/status ใน [from, to) — aggregate ด้วย SQL (spec 05 non-functional);
// pending สุทธิหลังหัก reversal ของ line ที่ยัง pending (กฎ 48b — พฤติกรรมเดียวของ service, กฎ 51)
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAffiliateEarningsSchemaType>,
  res: MedusaResponse
) {
  const service: AffiliateModuleService = req.scope.resolve(AFFILIATE_MODULE)
  const rows = await service.summarizeCommissionEntries({
    ...req.validatedQuery,
    affiliate_id: req.auth_context.actor_id,
  })

  res.json({ totals: rows.map(({ affiliate_id: _, ...row }) => row) })
}
