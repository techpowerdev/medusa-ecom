import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreGetActiveFlashSalesParams } from "./validators"

// FS-4: read-only (GET) จึงเปิดสาธารณะได้ (CLAUDE.md ข้อ 5) — /store/* ยังต้องมี publishable key ตาม Medusa
export const storeFlashSaleMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/flash-sales/active",
    middlewares: [validateAndTransformQuery(StoreGetActiveFlashSalesParams, {})],
  },
]
