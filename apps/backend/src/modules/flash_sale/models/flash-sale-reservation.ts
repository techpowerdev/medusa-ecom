import { model } from "@medusajs/framework/utils"

// สิทธิ์ flash ที่จองตอน complete cart (FS-3) — FS-2 คืนค่าตาม units ที่จองจริงผ่าน released_at (spec 03 กฎข้อ 10)
const FlashSaleReservation = model
  .define("flash_sale_reservation", {
    id: model.id({ prefix: "fsres" }).primaryKey(),
    cart_id: model.text(),
    campaign_id: model.text(),
    customer_id: model.text(),
    units: model.number(),
    released_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["cart_id", "campaign_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
  .checks([
    {
      name: "flash_sale_reservation_units_check",
      expression: (c) => `${c.units} > 0`,
    },
  ])

export default FlashSaleReservation
