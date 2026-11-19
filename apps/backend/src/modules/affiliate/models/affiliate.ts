import { model } from "@medusajs/framework/utils"

// Separate actor (not a customer); linked via auth_identity.app_metadata.affiliate_id
const Affiliate = model.define("affiliate", {
  id: model.id({ prefix: "aff" }).primaryKey(),
  // ADM-17 (spec 08 กฎ 21): `q` ของ GET /admin/affiliate/affiliates ค้น 2 ช่องนี้ (ilike ของ Medusa — ไม่เปลี่ยน schema)
  email: model.text().unique().searchable(),
  name: model.text().searchable(),
  code: model.text().unique(),
  status: model.enum(["pending", "active", "suspended"]).default("pending"),
  payout_info: model.json().nullable(),
})

export default Affiliate
