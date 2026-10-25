import { MedusaService } from "@medusajs/framework/utils"
import Affiliate from "./models/affiliate"
import AffiliateAttribution from "./models/affiliate-attribution"
import AffiliateProgram from "./models/affiliate-program"
import CommissionEntry from "./models/commission-entry"
import Payout from "./models/payout"

class AffiliateModuleService extends MedusaService({
  Affiliate,
  AffiliateProgram,
  AffiliateAttribution,
  CommissionEntry,
  Payout,
}) {}

export default AffiliateModuleService
