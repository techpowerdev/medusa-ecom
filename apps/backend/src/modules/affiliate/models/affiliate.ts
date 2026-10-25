import { model } from "@medusajs/framework/utils"

// Separate actor (not a customer); linked via auth_identity.app_metadata.affiliate_id
const Affiliate = model.define("affiliate", {
  id: model.id({ prefix: "aff" }).primaryKey(),
  email: model.text().unique(),
  name: model.text(),
  code: model.text().unique(),
  status: model.enum(["pending", "active", "suspended"]).default("pending"),
  payout_info: model.json().nullable(),
})

export default Affiliate
