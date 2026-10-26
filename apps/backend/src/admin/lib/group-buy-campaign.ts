// GB-6b: logic ล้วนของหน้ารายละเอียดแคมเปญ (ไม่ import sdk เพื่อให้ unit test ได้)
import type { GroupMode, TargetType } from "./group-buy-form"

export type CampaignStatus = "draft" | "active" | "ended"

// spec 04 กฎข้อ 10: draft → active → ended; ลบได้เฉพาะ draft; admin สร้าง pool ได้เมื่อแคมเปญ active และ mode อนุญาต pool
export const campaignActions = (c: { status: CampaignStatus; group_mode: GroupMode }) => ({
  activate: c.status === "draft",
  end: c.status === "active",
  remove: c.status === "draft",
  createPool: c.status === "active" && c.group_mode !== "team",
})

type Progress = { progress_orders: number; progress_units: number; progress_people: number }

export const groupProgress = (
  g: Progress,
  c: { target_type: TargetType; target_value: number }
) => `${g[`progress_${c.target_type}`]} / ${c.target_value} ${c.target_type}`
