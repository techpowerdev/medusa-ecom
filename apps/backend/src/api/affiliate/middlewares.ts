import {
  authenticate,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { AFFILIATE_CODE_RESERVED } from "../../modules/affiliate/errors"
import { requireAffiliateStatus } from "./helpers"
import {
  GetAffiliateEarningsSchema,
  GetAffiliateListSchema,
  GetAffiliateProductsSchema,
  isReservedAffiliateCode,
  PostAffiliateRegisterSchema,
  RESERVED_CODE_MESSAGE,
} from "./validators"

// กฎ 18: ทุก route ใต้ /affiliate/* ยกเว้น register — regex เพราะ matcher ซ้อนกันทำงานทั้งคู่
// (`/affiliate/*` จะครอบ register ที่ต้องใช้ allowUnregistered); regex ถูกเรียงก่อน matcher แบบ static ของ Medusa
// flag i: Express จับ route แบบไม่สนตัวพิมพ์ (`/AFFILIATE/me` ถึง route เดียวกัน) — review #110
export const AFFILIATE_PORTAL_MATCHER = /^\/affiliate\/(?!register\/?$).+/i

// CORE-84 (spec 01 กฎข้อ 140, ADR-028): error ของ zod validator ไม่มี code → ตรวจคำสงวนก่อน validate แล้วตอบ 400 พร้อม code
// (refine ใน schema คงไว้ — AC-53 ของ spec 05 ตรวจ schema ตรง)
const rejectReservedAffiliateCode = (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) =>
  next(
    isReservedAffiliateCode((req.body as { code?: unknown } | undefined)?.code)
      ? new MedusaError(MedusaError.Types.INVALID_DATA, RESERVED_CODE_MESSAGE, AFFILIATE_CODE_RESERVED)
      : undefined
  )

const query = (schema: Parameters<typeof validateAndTransformQuery>[0]) =>
  validateAndTransformQuery(schema, { isList: false })

// Q6: pending → เฉพาะ /affiliate/me; suspended → me, earnings, payouts (อ่านอย่างเดียว); products/programs เฉพาะ active
export const affiliatePortalMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/affiliate/register",
    middlewares: [
      authenticate("affiliate", ["session", "bearer"], { allowUnregistered: true }),
      rejectReservedAffiliateCode,
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
    middlewares: [requireAffiliateStatus("active"), query(GetAffiliateListSchema)],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/me/earnings",
    middlewares: [requireAffiliateStatus("active", "suspended"), query(GetAffiliateEarningsSchema)],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/me/payouts",
    middlewares: [requireAffiliateStatus("active", "suspended"), query(GetAffiliateListSchema)],
  },
  {
    method: ["GET"],
    matcher: "/affiliate/products",
    middlewares: [requireAffiliateStatus("active"), query(GetAffiliateProductsSchema)],
  },
]
