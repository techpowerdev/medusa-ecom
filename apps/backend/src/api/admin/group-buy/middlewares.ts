import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  AdminCreateGroupBuyCampaign,
  AdminCreateGroupBuyGroup,
  AdminGetGroupBuyCampaignParams,
  AdminGetGroupBuyGroupParams,
  AdminListGroupBuyCampaigns,
  AdminListGroupBuyGroups,
  AdminSetGroupBuyCampaignStatus,
  AdminUpdateGroupBuyCampaign,
} from "./validators"

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว
// campaign.* = Medusa campaign (ช่วงเวลา), promotion.* = promotion ต้นแบบ (ADR-011)
const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "target_type",
  "target_value",
  "max_total_orders",
  "max_units_per_person",
  "max_people_per_group",
  "group_mode",
  "team_duration_hours",
  "pay_within_hours",
  "status",
  "created_at",
  "updated_at",
  "campaign.id",
  "campaign.starts_at",
  "campaign.ends_at",
  "promotion.id",
  "promotion.code",
  "promotion.status",
]

// promotion.* = promotion ของกลุ่ม GB-<token> (link group ↔ promotion)
const GROUP_FIELDS = [
  "id",
  "campaign_id",
  "kind",
  "name",
  "created_by_customer_id",
  "join_token",
  "starts_at",
  "ends_at",
  "status",
  "succeeded_at",
  "pay_deadline_at",
  "progress_orders",
  "progress_units",
  "progress_people",
  "created_at",
  "updated_at",
  "promotion.id",
  "promotion.code",
  "promotion.status",
]

const retrieve = validateAndTransformQuery(AdminGetGroupBuyCampaignParams, {
  defaults: CAMPAIGN_FIELDS,
  isList: false,
})

export const adminGroupBuyMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/group-buy/campaigns",
    middlewares: [
      validateAndTransformQuery(AdminListGroupBuyCampaigns, {
        defaults: CAMPAIGN_FIELDS,
        isList: true,
        defaultLimit: 50,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/group-buy/campaigns",
    middlewares: [validateAndTransformBody(AdminCreateGroupBuyCampaign), retrieve],
  },
  {
    method: ["GET"],
    matcher: "/admin/group-buy/campaigns/:id",
    middlewares: [retrieve],
  },
  {
    method: ["POST"],
    matcher: "/admin/group-buy/campaigns/:id",
    middlewares: [validateAndTransformBody(AdminUpdateGroupBuyCampaign), retrieve],
  },
  {
    method: ["POST"],
    matcher: "/admin/group-buy/campaigns/:id/status",
    middlewares: [validateAndTransformBody(AdminSetGroupBuyCampaignStatus), retrieve],
  },
  {
    method: ["GET"],
    matcher: "/admin/group-buy/campaigns/:id/groups",
    middlewares: [
      validateAndTransformQuery(AdminListGroupBuyGroups, {
        defaults: GROUP_FIELDS,
        isList: true,
        defaultLimit: 50,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/group-buy/campaigns/:id/groups",
    middlewares: [
      validateAndTransformBody(AdminCreateGroupBuyGroup),
      validateAndTransformQuery(AdminGetGroupBuyGroupParams, {
        defaults: GROUP_FIELDS,
        isList: false,
      }),
    ],
  },
]
