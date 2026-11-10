import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { getActiveFlashSalesWorkflow } from "../../../../workflows/flash-sale/get-active-flash-sales"
import type { StoreGetActiveFlashSalesParams } from "../validators"

/**
 * FS-4 (spec 03 "API", AC-4): flash campaign ที่กำลังทำงาน + flash_price ต่อ variant
 *
 * ต่อ campaign (FS-7, กฎข้อ 4, AC-13): `sold_out` และ `remaining_units` อิงหน่วยใน `FlashSaleConfig`
 * (`units_sold`/`total_cap`) ไม่ใช่ campaign budget ของ Medusa — ไม่มี `remaining_usage` แล้ว
 *
 * ข้อจำกัดของ preview (กฎข้อ 14, owner ยอมรับใน v1 — Q4):
 * - `flash_price` คิดเฉพาะ promotion ที่ `application_method.target_type = "items"`; promotion แบบ
 *   `order`/`shipping_methods` ในแคมเปญไม่สะท้อนใน `flash_price` แม้มีผลใน cart
 * - promotion `type = "fixed"` ใน region ราคารวมภาษี (THB VAT 7%) ค่า preview อาจต่างจากยอดใน cart จริง;
 *   percentage ไม่ได้รับผลกระทบ — ยอดใน cart (คำนวณโดย Medusa) เป็นค่าที่ถูกต้องเสมอ
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetActiveFlashSalesParams>,
  res: MedusaResponse
) {
  const { region_id, variant_ids } = req.validatedQuery as StoreGetActiveFlashSalesParams
  const { result } = await getActiveFlashSalesWorkflow(req.scope).run({
    input: {
      region_id,
      variant_ids,
      sales_channel_ids: req.publishable_key_context?.sales_channel_ids ?? [],
    },
  })
  res.json(result)
}
