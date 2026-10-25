import { model } from "@medusajs/framework/utils"
import EvoucherPool from "./evoucher-pool"

// code/pin เก็บเป็น ciphertext (ดู utils/crypto.ts); code ใช้ deterministic IV เพื่อให้ unique ต่อ pool ได้
const EvoucherCode = model
  .define("evoucher_code", {
    id: model.id({ prefix: "evcode" }).primaryKey(),
    pool: model.belongsTo(() => EvoucherPool, { mappedBy: "codes" }),
    code: model.text(),
    pin: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    batch_ref: model.text(),
    status: model
      .enum(["available", "allocated", "delivered", "void"])
      .default("available"),
    // EV-5: ตั้งเมื่อ status → void ("expiring" จาก job รายวัน หรือข้อความจาก admin)
    void_reason: model.text().nullable(),
    order_id: model.text().nullable(),
    order_line_item_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    allocated_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    delivered_to_email: model.text().nullable(),
  })
  .indexes([
    { on: ["pool_id", "code"], unique: true },
    { on: ["pool_id", "status"] },
    // EV-6: widget หน้า order / resend ค้นด้วย order_id
    { on: ["order_id"] },
  ])

export default EvoucherCode
