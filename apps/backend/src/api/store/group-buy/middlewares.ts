import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  StoreCreateGroupBuyGroup,
  StoreJoinGroupBuyGroup,
  StoreListMyGroupBuyMemberships,
} from "./validators"

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
  // GB-8 (ADR-016): auth ของ customer มาจาก middleware `/store/customers/me*` ของ Medusa (ทดสอบ 401 ใน AC-38/39);
  // validator ใช้เฉพาะ limit/offset — fields กำหนดใน route (relation `order` ถูกตัดจาก fields ของ store route)
  {
    method: ["GET"],
    matcher: "/store/customers/me/group-buy/memberships",
    middlewares: [
      validateAndTransformQuery(StoreListMyGroupBuyMemberships, {
        defaults: ["id"],
        isList: true,
        defaultLimit: 20,
      }),
    ],
  },
]
