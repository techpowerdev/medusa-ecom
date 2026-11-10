import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import GroupBuyModule from "../modules/group_buy"

// ADR-009: read-only link ผ่าน field order_id (ไม่มี link table, ไม่ต้อง link.create)
export default defineLink(
  {
    linkable: GroupBuyModule.linkable.groupBuyMembership,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
)
