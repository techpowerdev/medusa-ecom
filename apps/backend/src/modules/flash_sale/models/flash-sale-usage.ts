import { model } from "@medusajs/framework/utils"

// จำนวนชิ้นที่ลูกค้าสั่งซื้อแล้วต่อแคมเปญ (spec 03 business rule 3) — FS-2 เป็นผู้เพิ่ม/ลดค่า
const FlashSaleUsage = model
  .define("flash_sale_usage", {
    id: model.id({ prefix: "fsuse" }).primaryKey(),
    campaign_id: model.text(),
    customer_id: model.text(),
    units: model.number().default(0),
  })
  .indexes([
    {
      on: ["campaign_id", "customer_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
  .checks([
    {
      name: "flash_sale_usage_units_check",
      expression: (c) => `${c.units} >= 0`,
    },
  ])

export default FlashSaleUsage
