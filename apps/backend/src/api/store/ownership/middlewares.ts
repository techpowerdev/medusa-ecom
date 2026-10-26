import {
  authenticate,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaResponse,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import {
  STORE_RESOURCE_NOT_FOUND,
  assertOwner,
  cartOwner,
  orderOwner,
  paymentCollectionOwner,
} from "../../../lib/store-ownership"
import { rejectStoreReturnOverrides } from "./return-overrides"

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
  // ระบุ GET เท่านั้น: transfer routes ใต้ `/store/orders/:id/*` ปิดด้วย matcher ด้านล่าง (CORE-13)
  {
    method: ["GET"],
    matcher: "/store/orders/:id",
    middlewares: [customerAuth, ensureStoreOwnership((req, query) => orderOwner(query, req.params.id))],
  },
  // CORE-13 (กฎ 24, AC-39): ตาม guide "Restrict Return Creation" ของ Medusa — core ไม่มี auth บน route นี้
  // CORE-16: ต่อจาก auth + owner check — ห้าม store ส่ง return_shipping.price / receive_now / location_id (400)
  {
    method: ["POST"],
    matcher: "/store/returns",
    middlewares: [
      customerAuth,
      ensureStoreOwnership((req, query) => orderOwner(query, body(req).order_id)),
      rejectStoreReturnOverrides,
    ],
  },
  // CORE-13 (owner Q-F3, AC-40): ปิด order transfer ทั้งชุด (request/accept/decline/cancel) — ไม่ระบุ method
  // จึงอยู่ใน bucket global ของ routes-sorter และทำงานก่อน authenticate แบบระบุ method ของ core (ไม่มี token ก็ได้ 404)
  {
    matcher: "/store/orders/:id/transfer",
    middlewares: [
      () => {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, STORE_RESOURCE_NOT_FOUND)
      },
    ],
  },
]
