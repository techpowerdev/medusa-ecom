import { sdk } from "./client"
import type { CampaignStatus } from "./group-buy-campaign"
import type { CampaignBody, GroupMode, TargetType } from "./group-buy-form"

// รูปร่าง response ของ admin API group-buy (src/api/admin/group-buy/*, GB-2a/GB-2b)
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

export type Group = {
  id: string
  kind: "pool" | "team"
  name: string | null
  status: "open" | "succeeded" | "failed"
  join_token: string
  ends_at: string
  progress_orders: number
  progress_units: number
  progress_people: number
}

export const groupBuyKeys = {
  campaigns: ["group-buy", "campaigns"] as const,
  campaign: (id: string) => ["group-buy", "campaigns", id] as const,
  groups: (id: string) => ["group-buy", "campaigns", id, "groups"] as const,
}

const BASE = "/admin/group-buy"

export const groupBuyApi = {
  listCampaigns: (query: { limit: number; offset: number }) =>
    sdk.client.fetch<{ campaigns: Campaign[]; count: number }>(`${BASE}/campaigns`, { query }),
  createCampaign: (body: CampaignBody) =>
    sdk.client.fetch<{ campaign: Campaign }>(`${BASE}/campaigns`, { method: "POST", body }),
  getCampaign: (id: string) => sdk.client.fetch<{ campaign: Campaign }>(`${BASE}/campaigns/${id}`),
  setStatus: (id: string, status: "active" | "ended") =>
    sdk.client.fetch<{ campaign: Campaign }>(`${BASE}/campaigns/${id}/status`, {
      method: "POST",
      body: { status },
    }),
  deleteCampaign: (id: string) =>
    sdk.client.fetch(`${BASE}/campaigns/${id}`, { method: "DELETE" }),
  listGroups: (id: string, query: { limit: number; offset: number }) =>
    sdk.client.fetch<{ groups: Group[]; count: number }>(`${BASE}/campaigns/${id}/groups`, { query }),
  createPoolGroup: (id: string) =>
    sdk.client.fetch<{ group: Group }>(`${BASE}/campaigns/${id}/groups`, { method: "POST", body: {} }),
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
