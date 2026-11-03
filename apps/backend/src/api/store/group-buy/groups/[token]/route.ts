import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  applicationMethodFields,
  CAMPAIGN_CONFIG_FIELDS,
  GROUP_FIELDS,
  type PublicCampaignSource,
  type PublicGroupSource,
  toPublicCampaign,
  toPublicGroup,
} from "../../../../../modules/group_buy/utils/public-campaign"

type Row = PublicGroupSource & {
  kind: "pool" | "team"
  campaign_id: string
  promotion?: Parameters<typeof toPublicCampaign>[1]
}

// spec 04 GB-11 (กฎข้อ 28): สาธารณะ อ่านอย่างเดียว กลุ่มทุกสถานะ (รวม team ด้วย token จากลิงก์แชร์) —
// ส่วนลด/สินค้าอ่านจาก promotion ของกลุ่ม ไม่ใช่ต้นแบบ (กฎข้อ 28e, Q5)
// Query 2 ครั้งคงที่ (ไม่ยิงต่อแถว): จาก group → `campaign` ชนชื่อกับ entity campaign ของ Promotion module (คืนว่าง แบบ GB-8)
// และจากแคมเปญ → `groups` ไม่ถูกกรองด้วย filter ของ relation (โหลดทุกกลุ่ม + promotion ของแต่ละกลุ่ม)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: groups } = await query.graph({
    entity: "group_buy_group",
    fields: [...GROUP_FIELDS, "campaign_id", ...applicationMethodFields("promotion")],
    filters: { join_token: req.params.token },
  })
  const group = groups[0] as Row | undefined
  if (!group) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Group not found")
  }
  const { data: campaigns } = await query.graph({
    entity: "group_buy_campaign",
    fields: CAMPAIGN_CONFIG_FIELDS,
    filters: { id: group.campaign_id },
  })
  res.json({
    group: { ...toPublicGroup(group), kind: group.kind },
    campaign: toPublicCampaign(campaigns[0] as PublicCampaignSource, group.promotion),
  })
}
