import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { requireAffiliateStatus } from "./helpers"
import { GetAffiliateEarningsSchema, GetAffiliateProductsSchema, PostAffiliateRegisterSchema } from "./validators"

// กฎ 18: ทุก route ใต้ /affiliate/* ยกเว้น register — regex เพราะ matcher ซ้อนกันทำงานทั้งคู่
// (`/affiliate/*` จะครอบ register ที่ต้องใช้ allowUnregistered); regex ถูกเรียงก่อน matcher แบบ static ของ Medusa
export const AFFILIATE_PORTAL_MATCHER = /^\/affiliate\/(?!register\/?$).+/

const query = (schema: Parameters<typeof validateAndTransformQuery>[0]) =>
  validateAndTransformQuery(schema, { isList: false })

// Q6: pending → เฉพาะ /affiliate/me; suspended → me, earnings, payouts (อ่านอย่างเดียว); products/programs เฉพาะ active
export const affiliatePortalMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/affiliate/register",
    middlewares: [
      authenticate("affiliate", ["session", "bearer"], { allowUnregistered: true }),
      validateAndTransformBody(PostAffiliateRegisterSchema),
    ],
  },
  {
    matcher: AFFILIATE_PORTAL_MATCHER,
    middlewares: [authenticate("affiliate", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/me/programs",
    middlewares: [requireAffiliateStatus("active")],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/me/earnings",
    middlewares: [requireAffiliateStatus("active", "suspended"), query(GetAffiliateEarningsSchema)],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/me/payouts",
    middlewares: [requireAffiliateStatus("active", "suspended")],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/products",
    middlewares: [requireAffiliateStatus("active"), query(GetAffiliateProductsSchema)],
  },
]
