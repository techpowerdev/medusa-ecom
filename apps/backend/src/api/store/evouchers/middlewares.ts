import { allowFields, MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreListMyEvouchers } from "./validators"

// EV-7a (spec 02 กฎข้อ 23): ข้อมูลพาร์ทเนอร์ของ voucher variant ผ่าน `fields` ของ GET /store/products* —
// ระบุทีละ field เท่านั้น ห้ามมี path ของ codes หรือ field ของ evoucher_code (Medusa ตัด field ที่ไม่ได้อนุญาตทิ้ง)
export const EVOUCHER_STORE_PRODUCT_FIELDS = [
  "variants.evoucher_pool.name",
  "variants.evoucher_pool.face_value",
  "variants.evoucher_pool.validity_note",
  "variants.evoucher_pool.how_to_use",
  "variants.evoucher_pool.partner.name",
  "variants.evoucher_pool.partner.logo_url",
  "variants.evoucher_pool.partner.terms_url",
]

export const storeEvoucherMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/products*",
    middlewares: [allowFields(EVOUCHER_STORE_PRODUCT_FIELDS)],
  },
  // กฎข้อ 22: auth ของ customer มาจาก middleware `/store/customers/me*` ของ Medusa (ยืนยันกับ source 2.22.1; ทดสอบ 401 ใน AC-34)
  {
    method: ["GET"],
    matcher: "/store/customers/me/evouchers",
    middlewares: [
      validateAndTransformQuery(StoreListMyEvouchers, {
        defaults: ["id"],
        isList: true,
        defaultLimit: 20,
      }),
    ],
  },
]
