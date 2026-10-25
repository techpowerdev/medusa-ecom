import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import multer from "multer"
import {
  AdminCreateEvoucherPartner,
  AdminCreateEvoucherPool,
  AdminListEvoucherCodesParams,
  AdminListEvoucherParams,
  AdminUpdateEvoucherPartner,
  AdminUpdateEvoucherPool,
} from "./validators"

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const PARTNER_FIELDS = ["id", "name", "logo_url", "terms_url", "support_contact", "created_at"]
const POOL_FIELDS = [
  "id",
  "variant_id",
  "name",
  "face_value",
  "validity_note",
  "how_to_use",
  "low_stock_threshold",
  "created_at",
  "partner.id",
  "partner.name",
]

export const adminEvoucherMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/evoucher/partners",
    middlewares: [
      validateAndTransformQuery(AdminListEvoucherParams, {
        defaults: PARTNER_FIELDS,
        isList: true,
      }),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/evoucher/partners/:id",
    middlewares: [
      validateAndTransformQuery(AdminListEvoucherParams, {
        defaults: PARTNER_FIELDS,
        isList: false,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/evoucher/partners",
    middlewares: [validateAndTransformBody(AdminCreateEvoucherPartner)],
  },
  {
    method: ["POST"],
    matcher: "/admin/evoucher/partners/:id",
    middlewares: [validateAndTransformBody(AdminUpdateEvoucherPartner)],
  },
  {
    method: ["GET"],
    matcher: "/admin/evoucher/pools",
    middlewares: [
      validateAndTransformQuery(AdminListEvoucherParams, {
        defaults: POOL_FIELDS,
        isList: true,
      }),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/evoucher/pools/:id",
    middlewares: [
      validateAndTransformQuery(AdminListEvoucherParams, {
        defaults: POOL_FIELDS,
        isList: false,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/evoucher/pools",
    middlewares: [validateAndTransformBody(AdminCreateEvoucherPool)],
  },
  {
    method: ["POST"],
    matcher: "/admin/evoucher/pools/:id",
    middlewares: [validateAndTransformBody(AdminUpdateEvoucherPool)],
  },
  {
    method: ["POST"],
    matcher: "/admin/evoucher/pools/:id/import",
    middlewares: [upload.single("file")],
  },
  {
    method: ["GET"],
    matcher: "/admin/evoucher/pools/:id/codes",
    middlewares: [validateAndTransformQuery(AdminListEvoucherCodesParams, {})],
  },
]
