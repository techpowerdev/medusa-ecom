import { authenticate, MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { StoreCreateGroupBuyGroup, StoreJoinGroupBuyGroup } from "./validators"

// CLAUDE.md ข้อ 5 / spec 04 AC-15: ทุก route ที่เขียนข้อมูลต้องมี customer ที่ล็อกอิน
const customerAuth = authenticate("customer", ["session", "bearer"])

export const storeGroupBuyMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/group-buy/groups",
    middlewares: [customerAuth, validateAndTransformBody(StoreCreateGroupBuyGroup)],
  },
  {
    method: ["POST"],
    matcher: "/store/group-buy/groups/:token/join",
    middlewares: [customerAuth, validateAndTransformBody(StoreJoinGroupBuyGroup)],
  },
  {
    method: ["POST"],
    matcher: "/store/group-buy/memberships/:id/leave",
    middlewares: [customerAuth],
  },
]
