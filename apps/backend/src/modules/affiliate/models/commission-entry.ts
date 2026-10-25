import { model } from "@medusajs/framework/utils"

// Append-only ledger; a reversal is a separate negative entry
const CommissionEntry = model
  .define("affiliate_commission_entry", {
    id: model.id({ prefix: "affcom" }).primaryKey(),
    affiliate_id: model.text(),
    program_id: model.text(),
    order_id: model.text(),
    line_item_id: model.text().nullable(),
    amount: model.bigNumber(),
    currency: model.text(),
    status: model.enum(["pending", "approved", "reversed", "paid"]).default("pending"),
    reason: model.text().nullable(),
    matures_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["affiliate_id", "status", "created_at"] },
    { on: ["order_id", "line_item_id"], unique: true, where: { status: "pending" } },
  ])

export default CommissionEntry
