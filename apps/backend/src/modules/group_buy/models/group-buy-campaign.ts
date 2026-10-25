import { model } from "@medusajs/framework/utils"
import GroupBuyGroup from "./group-buy-group"
import GroupBuyMembership from "./group-buy-membership"

const positiveOrNull = (column: string) => `${column} IS NULL OR ${column} > 0`

// แคมเปญ group buy (spec 04, ADR-004) — ส่วนลด/ขอบเขตสินค้า/starts_at/ends_at อยู่ที่ Medusa campaign + promotion
// ที่ลิงก์ไว้ (src/links/group-buy-campaign-promotion-campaign.ts) ไม่เก็บซ้ำที่นี่
const GroupBuyCampaign = model
  .define("group_buy_campaign", {
    id: model.id({ prefix: "gbcamp" }).primaryKey(),
    name: model.text(),
    target_type: model.enum(["orders", "units", "people"]),
    target_value: model.number(),
    max_total_orders: model.number().nullable(),
    max_units_per_person: model.number().nullable(),
    max_people_per_group: model.number().nullable(),
    group_mode: model.enum(["pool", "team", "both"]),
    team_duration_hours: model.number().nullable(),
    pay_within_hours: model.number().default(24),
    status: model.enum(["draft", "active", "ended"]).default("draft"),
    groups: model.hasMany(() => GroupBuyGroup, { mappedBy: "campaign" }),
    memberships: model.hasMany(() => GroupBuyMembership, { mappedBy: "campaign" }),
  })
  .checks([
    {
      name: "group_buy_campaign_target_value_check",
      expression: (c) => `${c.target_value} > 0`,
    },
    {
      name: "group_buy_campaign_pay_within_hours_check",
      expression: (c) => `${c.pay_within_hours} > 0`,
    },
    {
      name: "group_buy_campaign_max_total_orders_check",
      expression: (c) => positiveOrNull(c.max_total_orders),
    },
    {
      name: "group_buy_campaign_max_units_per_person_check",
      expression: (c) => positiveOrNull(c.max_units_per_person),
    },
    {
      name: "group_buy_campaign_max_people_per_group_check",
      expression: (c) => positiveOrNull(c.max_people_per_group),
    },
    {
      name: "group_buy_campaign_team_duration_hours_check",
      expression: (c) => positiveOrNull(c.team_duration_hours),
    },
  ])

export default GroupBuyCampaign
