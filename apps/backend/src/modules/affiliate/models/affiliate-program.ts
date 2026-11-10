import { model } from "@medusajs/framework/utils"

// A commission window; "active" / "upcoming" are derived from starts_at/ends_at
const AffiliateProgram = model.define("affiliate_program", {
  id: model.id({ prefix: "affprog" }).primaryKey(),
  name: model.text(),
  starts_at: model.dateTime(),
  ends_at: model.dateTime(),
  status: model.enum(["draft", "published", "ended"]).default("draft"),
  announce_text: model.text().nullable(),
  commission_type: model.enum(["percentage"]).default("percentage"),
  commission_value: model.bigNumber(),
  scope: model.json(),
  attribution_window_days: model.number().default(7),
  cap_per_order: model.bigNumber().nullable(),
  hold_days: model.number().default(14),
})

export default AffiliateProgram
