import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import EvoucherModule from "../modules/evoucher"

// EV-9: read-only link evoucher_code.order_id -> order (ไม่มีตาราง pivot แบบเดียวกับ ADR-009)
export default defineLink(
  {
    linkable: EvoucherModule.linkable.evoucherCode,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
)
