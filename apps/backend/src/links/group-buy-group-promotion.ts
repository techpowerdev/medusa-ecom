import { defineLink } from "@medusajs/framework/utils"
import PromotionModule from "@medusajs/medusa/promotion"
import GroupBuyModule from "../modules/group_buy"

// spec 04: 1 กลุ่ม ↔ 1 Medusa promotion แบบใช้ code `GB-<token>` (is_automatic=false)
export default defineLink(
  GroupBuyModule.linkable.groupBuyGroup,
  PromotionModule.linkable.promotion
)
