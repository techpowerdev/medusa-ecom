import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  applicationMethodFields,
  CAMPAIGN_CONFIG_FIELDS,
  GROUP_FIELDS,
  isCampaignLive,
  isListedPool,
  type PublicCampaignSource,
  type PublicGroupSource,
  toPublicCampaign,
  toPublicGroup,
} from "../../../../../modules/group_buy/utils/public-campaign"

const MAX_CAMPAIGNS = 50

type Row = PublicCampaignSource & {
  status: "draft" | "active" | "ended"
  promotion?: Parameters<typeof toPublicCampaign>[1]
  groups?: (PublicGroupSource & { kind: string })[] | null
}

// spec 04 GB-11 (กฎข้อ 28): สาธารณะ อ่านอย่างเดียว — query.graph ครั้งเดียว (ต้นแบบ + Medusa campaign + กลุ่ม) แล้วกรองใน route
// (แคมเปญ active พร้อมกัน ≤ 50 — กฎข้อ 28f); แคมเปญที่ต้นแบบไม่ใช่สินค้าเดียว (กฎข้อ 30) ไม่คืน
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "group_buy_campaign",
    fields: [
      ...CAMPAIGN_CONFIG_FIELDS,
      ...applicationMethodFields("promotion"),
      ...GROUP_FIELDS.map((f) => `groups.${f}`),
    ],
    filters: { status: "active" },
  })
  const now = new Date()
  const campaigns = (data as Row[])
    .filter((c) =>
      isCampaignLive(
        {
          status: c.status,
          starts_at: c.campaign?.starts_at,
          ends_at: c.campaign?.ends_at,
        },
        now
      )
    )
    .map((c) => ({
      ...toPublicCampaign(c, c.promotion),
      pool_groups: (c.groups ?? []).filter((g) => isListedPool(g, now)).map(toPublicGroup),
    }))
    .filter((c) => c.product_id !== null)
    .sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime())
    .slice(0, MAX_CAMPAIGNS)
  res.json({ campaigns })
}
