import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  AdminAffiliateSummaryParams,
  AdminCreateAffiliateProgram,
  AdminCreatePayout,
  AdminGetAffiliateParams,
  AdminListAffiliatePrograms,
  AdminListAffiliates,
  AdminListCommissionEntries,
  AdminListPayouts,
  AdminMarkPayoutPaid,
  AdminUpdateAffiliate,
  AdminUpdateAffiliateProgram,
} from "./validators"

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว; payout_info แสดงเฉพาะฝั่ง admin (กฎ 8)
const PROGRAM_FIELDS = [
  "id",
  "name",
  "starts_at",
  "ends_at",
  "status",
  "announce_text",
  "commission_type",
  "commission_value",
  "scope",
  "attribution_window_days",
  "cap_per_order",
  "hold_days",
  "created_at",
  "updated_at",
]
const AFFILIATE_FIELDS = ["id", "email", "name", "code", "status", "payout_info", "created_at"]
const ENTRY_FIELDS = [
  "id",
  "affiliate_id",
  "program_id",
  "order_id",
  "line_item_id",
  "amount",
  "currency",
  "status",
  "reason",
  "matures_at",
  "created_at",
]
const PAYOUT_FIELDS = [
  "id",
  "affiliate_id",
  "amount",
  "currency",
  "period_from",
  "period_to",
  "status",
  "paid_at",
  "reference",
  "entry_ids",
  "created_at",
]

const list = (schema: Parameters<typeof validateAndTransformQuery>[0], defaults: string[]) =>
  validateAndTransformQuery(schema, { defaults, isList: true, defaultLimit: 50 })
const retrieve = (defaults: string[]) =>
  validateAndTransformQuery(AdminGetAffiliateParams, { defaults, isList: false })

export const adminAffiliateMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/affiliate/programs",
    middlewares: [list(AdminListAffiliatePrograms, PROGRAM_FIELDS)],
  },
  {
    method: ["POST"],
    matcher: "/admin/affiliate/programs",
    middlewares: [validateAndTransformBody(AdminCreateAffiliateProgram), retrieve(PROGRAM_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/programs/:id",
    middlewares: [retrieve(PROGRAM_FIELDS)],
  },
  {
    method: ["POST"],
    matcher: "/admin/affiliate/programs/:id",
    middlewares: [validateAndTransformBody(AdminUpdateAffiliateProgram), retrieve(PROGRAM_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/affiliates",
    middlewares: [list(AdminListAffiliates, AFFILIATE_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/affiliates/:id",
    middlewares: [retrieve(AFFILIATE_FIELDS)],
  },
  {
    method: ["POST"],
    matcher: "/admin/affiliate/affiliates/:id",
    middlewares: [validateAndTransformBody(AdminUpdateAffiliate), retrieve(AFFILIATE_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/entries",
    middlewares: [list(AdminListCommissionEntries, ENTRY_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/payouts",
    middlewares: [list(AdminListPayouts, PAYOUT_FIELDS)],
  },
  {
    method: ["POST"],
    matcher: "/admin/affiliate/payouts",
    middlewares: [validateAndTransformBody(AdminCreatePayout), retrieve(PAYOUT_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/payouts/:id",
    middlewares: [retrieve(PAYOUT_FIELDS)],
  },
  {
    method: ["POST"],
    matcher: "/admin/affiliate/payouts/:id/mark-paid",
    middlewares: [validateAndTransformBody(AdminMarkPayoutPaid), retrieve(PAYOUT_FIELDS)],
  },
  {
    method: ["GET"],
    matcher: "/admin/affiliate/reports/summary",
    middlewares: [validateAndTransformQuery(AdminAffiliateSummaryParams, {})],
  },
]
