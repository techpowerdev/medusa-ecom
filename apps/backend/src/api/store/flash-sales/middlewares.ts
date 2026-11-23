import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreGetActiveFlashSalesParams } from "./validators"

// FS-4: read-only (GET) จึงเปิดสาธารณะได้ (CLAUDE.md ข้อ 5) — /store/* ยังต้องมี publishable key ตาม Medusa
// FS-20 (allowance ของลูกค้า) อยู่ที่ `store/customers/me/middlewares.ts`
export const storeFlashSaleMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/flash-sales/active",
    middlewares: [validateAndTransformQuery(StoreGetActiveFlashSalesParams, {})],
  },
]
