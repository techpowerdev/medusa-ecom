import { sdk } from "./client"
import type { CampaignBody, GroupMode, TargetType } from "./group-buy-form"

// รูปร่าง response ของ admin API group-buy (src/api/admin/group-buy/*, GB-2a/GB-2b)
export type CampaignStatus = "draft" | "active" | "ended"
export const CAMPAIGN_STATUS_COLOR: Record<CampaignStatus, "grey" | "green" | "orange"> = {
  draft: "grey",
  active: "green",
  ended: "orange",
}

export type Campaign = {
  id: string
  name: string
  target_type: TargetType
  target_value: number
  group_mode: GroupMode
  status: CampaignStatus
  template_promotion_id: string | null
  campaign: { id: string; starts_at: string | null; ends_at: string | null } | null
  promotion: { id: string; code: string; status: string } | null
}

export const groupBuyKeys = {
  campaigns: ["group-buy", "campaigns"] as const,
}

const BASE = "/admin/group-buy"

export const groupBuyApi = {
  listCampaigns: (query: { limit: number; offset: number }) =>
    sdk.client.fetch<{ campaigns: Campaign[]; count: number }>(`${BASE}/campaigns`, { query }),
  createCampaign: (body: CampaignBody) =>
    sdk.client.fetch<{ campaign: Campaign }>(`${BASE}/campaigns`, { method: "POST", body }),
}

// แสดงเวลาไทยเสมอ (ฟอร์มก็ตีความเป็น ICT) ไม่ขึ้นกับ timezone ของ browser
export const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-"
