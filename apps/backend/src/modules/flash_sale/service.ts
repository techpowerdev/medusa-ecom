import { MedusaService } from "@medusajs/framework/utils"
import FlashSaleConfig from "./models/flash-sale-config"
import FlashSaleUsage from "./models/flash-sale-usage"

class FlashSaleModuleService extends MedusaService({
  FlashSaleConfig,
  FlashSaleUsage,
}) {}

export default FlashSaleModuleService
