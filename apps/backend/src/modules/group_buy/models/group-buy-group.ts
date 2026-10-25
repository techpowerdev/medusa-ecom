import { model } from "@medusajs/framework/utils"
import GroupBuyCampaign from "./group-buy-campaign"
import GroupBuyMembership from "./group-buy-membership"

// กลุ่ม 1 กลุ่ม = promotion code 1 โค้ด `GB-<join_token>` (link: src/links/group-buy-group-promotion.ts)
// ตัวนับ progress_* เป็น denormalized ปรับภายใต้ lock ของกลุ่มใน joinGroupWorkflow (GB-3, ADR-009)
const GroupBuyGroup = model
  .define("group_buy_group", {
    id: model.id({ prefix: "gbgrp" }).primaryKey(),
    campaign: model.belongsTo(() => GroupBuyCampaign, { mappedBy: "groups" }),
    kind: model.enum(["pool", "team"]),
    created_by_customer_id: model.text().nullable(),
    name: model.text().nullable(),
    join_token: model.text().unique(),
    starts_at: model.dateTime(),
    ends_at: model.dateTime(),
    status: model.enum(["open", "succeeded", "failed"]).default("open"),
    succeeded_at: model.dateTime().nullable(),
    pay_deadline_at: model.dateTime().nullable(),
    progress_orders: model.number().default(0),
    progress_units: model.number().default(0),
    progress_people: model.number().default(0),
    memberships: model.hasMany(() => GroupBuyMembership, { mappedBy: "group" }),
  })
  .indexes([
    { on: ["status", "ends_at"], where: "deleted_at IS NULL" },
    { on: ["status", "pay_deadline_at"], where: "deleted_at IS NULL" },
  ])
  .checks([
    {
      name: "group_buy_group_progress_check",
      expression: (c) =>
        `${c.progress_orders} >= 0 AND ${c.progress_units} >= 0 AND ${c.progress_people} >= 0`,
    },
  ])

export default GroupBuyGroup
