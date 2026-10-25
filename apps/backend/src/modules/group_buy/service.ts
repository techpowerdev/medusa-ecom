import { MedusaService } from "@medusajs/framework/utils"
import GroupBuyCampaign from "./models/group-buy-campaign"
import GroupBuyGroup from "./models/group-buy-group"
import GroupBuyMembership from "./models/group-buy-membership"

// CRUD เท่านั้น — logic ข้าม module (promotion, draft order, lock) อยู่ใน workflow (GB-2+)
class GroupBuyModuleService extends MedusaService({
  GroupBuyCampaign,
  GroupBuyGroup,
  GroupBuyMembership,
}) {}

export default GroupBuyModuleService
