import { defineLink } from "@medusajs/framework/utils"
import PromotionModule from "@medusajs/medusa/promotion"
import GroupBuyModule from "../modules/group_buy"

// spec 04: 1 แคมเปญ group buy ↔ 1 Medusa campaign (ช่วงเวลา/budget)
export default defineLink(
  GroupBuyModule.linkable.groupBuyCampaign,
  PromotionModule.linkable.campaign
)
