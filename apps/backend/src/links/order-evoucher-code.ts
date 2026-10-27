import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import EvoucherModule from "../modules/evoucher"

// EV-9 (AC-16): read-only link ฝั่งกลับ order.id -> evoucher_code.order_id (หลาย code ต่อ order)
// ใช้โดย widget order (EV-6) และ resend (EV-5b): query.graph({ entity: "order", fields: ["evoucher_codes.*"] })
export default defineLink(
  {
    linkable: OrderModule.linkable.order,
    field: "id",
  },
  {
    ...EvoucherModule.linkable.evoucherCode.id,
    primaryKey: "order_id",
  },
  // isList ของ read-only link อ่านจาก option นี้ (alias เป็นพหูพจน์ `evoucher_codes`)
  { readOnly: true, isList: true }
)
