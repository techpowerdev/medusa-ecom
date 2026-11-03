import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  applicationMethodFields,
  CAMPAIGN_CONFIG_FIELDS,
  GROUP_FIELDS,
  isCampaignLive,
  type PublicCampaignSource,
  type PublicGroupSource,
  toPublicCampaign,
  toPublicGroup,
} from "../../../../../modules/group_buy/utils/public-campaign"

const MAX_CAMPAIGNS = 50

type Row = PublicCampaignSource & {
  status: "draft" | "active" | "ended"
  promotion?: Parameters<typeof toPublicCampaign>[1]
}

// spec 04 GB-11 (กฎข้อ 28): สาธารณะ อ่านอย่างเดียว — query.graph 2 ครั้งคงที่ต่อ request:
// (1) แคมเปญ active + ต้นแบบ + Medusa campaign (≤ 50 พร้อมกัน — กฎข้อ 28f) กรองช่วงเวลา/สินค้าเดียว (กฎข้อ 28c, 28e, 30) ใน route
// (2) เฉพาะ pool ที่ open และยังไม่หมดเวลาของแคมเปญที่ผ่าน (กฎข้อ 28d) — กรองใน DB (index `(status, ends_at)`) ไม่โหลด team
//     ที่ลูกค้าสร้างได้ไม่จำกัด หรือกลุ่มที่จบแล้ว (review #230)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "group_buy_campaign",
    fields: [...CAMPAIGN_CONFIG_FIELDS, ...applicationMethodFields("promotion")],
    filters: { status: "active" },
  })
  const now = new Date()
  const campaigns = (data as Row[])
    .filter((c) =>
      isCampaignLive({ status: c.status, starts_at: c.campaign?.starts_at, ends_at: c.campaign?.ends_at }, now)
    )
    .map((c) => toPublicCampaign(c, c.promotion))
    .filter((c) => c.product_id !== null)
    // isCampaignLive ผ่านแล้ว ends_at จึงไม่เป็น null
    .sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime())
    .slice(0, MAX_CAMPAIGNS)
  if (!campaigns.length) {
    res.json({ campaigns: [] })
    return
  }

  const { data: groups } = await query.graph({
    entity: "group_buy_group",
    fields: [...GROUP_FIELDS, "campaign_id"],
    filters: { campaign_id: campaigns.map((c) => c.id), kind: "pool", status: "open", ends_at: { $gt: now } },
  })
  const poolsOf = new Map<string, ReturnType<typeof toPublicGroup>[]>()
  for (const g of groups as (PublicGroupSource & { campaign_id: string })[]) {
    poolsOf.set(g.campaign_id, [...(poolsOf.get(g.campaign_id) ?? []), toPublicGroup(g)])
  }
  res.json({ campaigns: campaigns.map((c) => ({ ...c, pool_groups: poolsOf.get(c.id) ?? [] })) })
}
