import { model } from "@medusajs/framework/utils"

const AffiliateAttribution = model.define("affiliate_attribution", {
  id: model.id({ prefix: "affattr" }).primaryKey(),
  order_id: model.text().unique(),
  affiliate_id: model.text().index(),
  // null when no program was active at order time (AC-2)
  program_id: model.text().nullable(),
  attributed_at: model.dateTime(),
})

export default AffiliateAttribution
