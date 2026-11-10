import { model } from "@medusajs/framework/utils"

// audit การเปิดดู code จริง (AC-8): ใคร (actor), เมื่อไร (created_at), code ไหน
const EvoucherCodeReveal = model.define("evoucher_code_reveal", {
  id: model.id({ prefix: "evrev" }).primaryKey(),
  code_id: model.text().index(),
  actor_type: model.text(),
  actor_id: model.text(),
})

export default EvoucherCodeReveal
