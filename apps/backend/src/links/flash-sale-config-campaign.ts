import { defineLink } from "@medusajs/framework/utils"
import PromotionModule from "@medusajs/medusa/promotion"
import FlashSaleModule from "../modules/flash_sale"

// flash_sale_config ↔ promotion campaign (spec 03): read-only link ผ่านคอลัมน์ campaign_id
// ไม่สร้าง link table — campaign_id (unique) เป็นแหล่งข้อมูลเดียว
export default defineLink(
  {
    linkable: FlashSaleModule.linkable.flashSaleConfig,
    field: "campaign_id",
  },
  PromotionModule.linkable.campaign,
  { readOnly: true }
)
