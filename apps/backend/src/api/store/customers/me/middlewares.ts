import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreGetFlashSaleAllowanceParams } from "../../flash-sales/validators"

// route ของเราใต้ `/store/customers/me/*` — auth ของ customer มาจาก middleware `/store/customers/me*` ของ Medusa
export const storeCustomerMeMiddlewares: MiddlewareRoute[] = [
  // FS-20 (spec 03 กฎข้อ 25): ทดสอบ 401 ใน AC-27
  {
    method: ["GET"],
    matcher: "/store/customers/me/flash-sales/allowance",
    middlewares: [validateAndTransformQuery(StoreGetFlashSaleAllowanceParams, {})],
  },
]
