import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AFFILIATE_MODULE } from "../../../../../modules/affiliate"
import AffiliateModuleService from "../../../../../modules/affiliate/service"
import { AdminAffiliateSummaryParams } from "../../validators"

// Read-only aggregate from one module; no cross-module logic → no workflow needed
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminAffiliateSummaryParams>,
  res: MedusaResponse
) {
  const service: AffiliateModuleService = req.scope.resolve(AFFILIATE_MODULE)
  // กฎ 49 (AF-25): pending สุทธิแบบเดียวกับ /affiliate/me/earnings (กฎ 48b — พฤติกรรมเดียวของ service, กฎ 51)
  const summary = await service.summarizeCommissionEntries(req.validatedQuery as AdminAffiliateSummaryParams)
  res.json({ summary })
}
