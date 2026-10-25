import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { AdminUpsertFlashSaleConfig } from "./validators"

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว
export const adminFlashSaleMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/flash-sales/:campaign_id/config",
    middlewares: [validateAndTransformBody(AdminUpsertFlashSaleConfig)],
  },
]
