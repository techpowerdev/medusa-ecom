import { model } from "@medusajs/framework/utils"

const Payout = model.define("affiliate_payout", {
  id: model.id({ prefix: "affpay" }).primaryKey(),
  affiliate_id: model.text().index(),
  amount: model.bigNumber(),
  currency: model.text(),
  period_from: model.dateTime(),
  period_to: model.dateTime(),
  status: model.enum(["draft", "paid"]).default("draft"),
  paid_at: model.dateTime().nullable(),
  reference: model.text().nullable(),
  entry_ids: model.array(),
})

export default Payout
