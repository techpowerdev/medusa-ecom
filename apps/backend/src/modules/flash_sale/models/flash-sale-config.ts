import { model } from "@medusajs/framework/utils"

// ตัวเลือกเพิ่มของ Medusa Campaign ที่เป็น flash sale (spec 03, ADR-003)
// ส่วนลด/ช่วงเวลา/budget อยู่ที่ Campaign + Promotion ของ Medusa — ที่นี่เก็บเฉพาะส่วนที่ Medusa ไม่มี
const FlashSaleConfig = model
  .define("flash_sale_config", {
    id: model.id({ prefix: "fsconf" }).primaryKey(),
    // read-only link → promotion campaign (src/links/flash-sale-config-campaign.ts)
    campaign_id: model.text().unique(),
    per_customer_limit: model.number().nullable(),
    total_cap: model.number().nullable(),
    // counter แบบ atomic สำหรับ total_cap — FS-3 เป็นผู้จอง/อัปเดต
    units_sold: model.number().default(0),
    show_countdown: model.boolean().default(false),
    show_remaining: model.boolean().default(false),
    banner_text: model.text().nullable(),
  })
  .checks([
    {
      name: "flash_sale_config_units_sold_check",
      expression: (c) => `${c.units_sold} >= 0`,
    },
    {
      name: "flash_sale_config_per_customer_limit_check",
      expression: (c) =>
        `${c.per_customer_limit} IS NULL OR ${c.per_customer_limit} > 0`,
    },
    {
      name: "flash_sale_config_total_cap_check",
      expression: (c) => `${c.total_cap} IS NULL OR ${c.total_cap} > 0`,
    },
  ])

export default FlashSaleConfig
