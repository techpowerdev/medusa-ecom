import {
  authenticate,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaResponse,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { assertOwner, cartOwner, orderOwner, paymentCollectionOwner } from "../../../lib/store-ownership"

// CORE-12 (spec 01 "API routes" + กฎ 22, ADR-013 ทางเลือก A): ตรวจเจ้าของ resource บน route ของ Medusa
// ด้วย defineMiddlewares — ไม่ห่อ route และไม่ใช้ workflow hook
type OwnerResolver = (req: AuthenticatedMedusaRequest, query: RemoteQueryFunction) => Promise<string | null>

export function ensureStoreOwnership(resolveOwner: OwnerResolver) {
  return async (req: AuthenticatedMedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
    assertOwner(await resolveOwner(req, query), req.auth_context?.actor_id)
    next()
  }
}

const customerAuth = authenticate("customer", ["session", "bearer"])
const body = (req: AuthenticatedMedusaRequest) => (req.body ?? {}) as Record<string, unknown>

const cartFromPath = ensureStoreOwnership((req, query) => cartOwner(query, req.params.id))
const cartFromBody = ensureStoreOwnership((req, query) => cartOwner(query, body(req).cart_id))

// `/store/carts*` และ `/store/payment-collections*` มี authenticate จาก CORE-6 แล้ว (matcher ไม่ระบุ method
// อยู่ใน bucket global ระดับบน จึงทำงานก่อน matcher ด้านล่าง) — shipping-options และ orders/:id ต้องใส่เอง
export const storeOwnershipMiddlewares: MiddlewareRoute[] = [
  // ไม่ระบุ method = ทุก method และ express `use` จับ path ลูกด้วย (`/store/carts/:id/*`)
  { matcher: "/store/carts/:id", middlewares: [cartFromPath] },
  { method: ["POST"], matcher: "/store/payment-collections", middlewares: [cartFromBody] },
  {
    matcher: "/store/payment-collections/:id/payment-sessions",
    middlewares: [ensureStoreOwnership((req, query) => paymentCollectionOwner(query, req.params.id))],
  },
  { matcher: "/store/shipping-options*", middlewares: [customerAuth] },
  {
    method: ["GET"],
    matcher: "/store/shipping-options",
    middlewares: [ensureStoreOwnership((req, query) => cartOwner(query, req.query.cart_id))],
  },
  { method: ["POST"], matcher: "/store/shipping-options/:id/calculate", middlewares: [cartFromBody] },
  // ระบุ GET เท่านั้น: transfer routes ใต้ `/store/orders/:id/*` เป็นงานของ CORE-13
  {
    method: ["GET"],
    matcher: "/store/orders/:id",
    middlewares: [customerAuth, ensureStoreOwnership((req, query) => orderOwner(query, req.params.id))],
  },
]
