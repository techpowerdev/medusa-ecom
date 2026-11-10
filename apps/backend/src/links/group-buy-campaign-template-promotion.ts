import { defineLink } from "@medusajs/framework/utils"
import PromotionModule from "@medusajs/medusa/promotion"
import GroupBuyModule from "../modules/group_buy"

// ADR-011 (link "template"): 1 แคมเปญ group buy ↔ 1 promotion ต้นแบบ (status=draft, code GBT-*)
// link นี้คือ marker ว่า promotion ไหนเป็นต้นแบบ — Query: group_buy_campaign.promotion
export default defineLink(
  GroupBuyModule.linkable.groupBuyCampaign,
  PromotionModule.linkable.promotion
)
