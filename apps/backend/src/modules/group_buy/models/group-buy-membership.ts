import { model } from "@medusajs/framework/utils"
import GroupBuyCampaign from "./group-buy-campaign"
import GroupBuyGroup from "./group-buy-group"

// การเข้าร่วม 1 ครั้ง = draft order 1 ใบ; ลูกค้าคนเดียวมีได้หลายแถวในกลุ่มเดียว (ADR-009 — ไม่มี unique (group_id, customer_id))
// campaign_id คัดลอกจากกลุ่มตอน join และไม่เปลี่ยนภายหลัง; order_id = read-only link → order
// (src/links/group-buy-membership-order.ts)
const GroupBuyMembership = model
  .define("group_buy_membership", {
    id: model.id({ prefix: "gbmem" }).primaryKey(),
    campaign: model.belongsTo(() => GroupBuyCampaign, { mappedBy: "memberships" }),
    group: model.belongsTo(() => GroupBuyGroup, { mappedBy: "memberships" }),
    customer_id: model.text(),
    order_id: model.text().unique(),
    units: model.number(),
    joined_at: model.dateTime(),
    status: model
      .enum(["joined", "awaiting_payment", "paid", "cancelled"])
      .default("joined"),
  })
  .indexes([
    { on: ["campaign_id", "customer_id"], where: "deleted_at IS NULL" },
    { on: ["group_id", "status"], where: "deleted_at IS NULL" },
    // GB-8 (spec 04 กฎข้อ 21): store route หา membership ของผู้เรียกเรียง joined_at
    { on: ["customer_id", "joined_at"], where: "deleted_at IS NULL" },
  ])
  .checks([
    {
      name: "group_buy_membership_units_check",
      expression: (c) => `${c.units} > 0`,
    },
  ])

export default GroupBuyMembership
