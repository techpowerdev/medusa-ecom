import { model } from "@medusajs/framework/utils"
import EvoucherPartner from "./evoucher-partner"
import EvoucherCode from "./evoucher-code"

// 1 pool ต่อ 1 product variant (variant_id unique; link read-only ใน src/links/)
const EvoucherPool = model.define("evoucher_pool", {
  id: model.id({ prefix: "evpool" }).primaryKey(),
  partner: model.belongsTo(() => EvoucherPartner, { mappedBy: "pools" }),
  variant_id: model.text().unique(),
  name: model.text(),
  face_value: model.bigNumber().nullable(),
  validity_note: model.text().nullable(),
  how_to_use: model.text(),
  low_stock_threshold: model.number().default(20),
  codes: model.hasMany(() => EvoucherCode, { mappedBy: "pool" }),
})

export default EvoucherPool
