import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreGetActiveFlashSalesParams, StoreGetFlashSaleAllowanceParams } from "./validators"

// FS-4: read-only (GET) จึงเปิดสาธารณะได้ (CLAUDE.md ข้อ 5) — /store/* ยังต้องมี publishable key ตาม Medusa
export const storeFlashSaleMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/flash-sales/active",
    middlewares: [validateAndTransformQuery(StoreGetActiveFlashSalesParams, {})],
  },
  // FS-20 (กฎข้อ 25): auth ของ customer มาจาก middleware `/store/customers/me*` ของ Medusa (ทดสอบ 401 ใน AC-27)
  {
    method: ["GET"],
    matcher: "/store/customers/me/flash-sales/allowance",
    middlewares: [validateAndTransformQuery(StoreGetFlashSaleAllowanceParams, {})],
  },
]
