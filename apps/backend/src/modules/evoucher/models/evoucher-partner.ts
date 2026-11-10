import { model } from "@medusajs/framework/utils"
import EvoucherPool from "./evoucher-pool"

const EvoucherPartner = model.define("evoucher_partner", {
  id: model.id({ prefix: "evptn" }).primaryKey(),
  name: model.text(),
  logo_url: model.text().nullable(),
  terms_url: model.text().nullable(),
  support_contact: model.text().nullable(),
  pools: model.hasMany(() => EvoucherPool, { mappedBy: "partner" }),
})

export default EvoucherPartner
