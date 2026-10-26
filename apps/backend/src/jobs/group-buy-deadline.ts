import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GROUP_BUY_MODULE } from "../modules/group_buy"
import type GroupBuyModuleService from "../modules/group_buy/service"
import { expiredGroupOutcome, isCampaignExpired } from "../modules/group_buy/utils/group-outcome"
import { setGroupBuyCampaignStatusWorkflow } from "../workflows/group-buy/campaign-status"
import { failGroupWorkflow, succeedGroupWorkflow } from "../workflows/group-buy/group-outcome"

// spec 04 Non-functional: ≤ 50 กลุ่มต่อรอบ
const BATCH = 50

// spec 04 scheduled job (GB-4): กลุ่ม open ที่ ends_at <= now → succeed/fail ตามเป้าหมาย (AC-3, AC-11, AC-12)
// และแคมเปญ active ที่ ends_at ของ Medusa campaign ผ่านไปแล้ว → ended (AC-22)
// หมดเวลาชำระเงิน (awaiting_payment) อยู่ใน GB-5
export default async function groupBuyDeadlineJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
  const now = new Date()

  const groups = await service.listGroupBuyGroups(
    { status: "open", ends_at: { $lte: now } },
    { relations: ["campaign"], take: BATCH, order: { ends_at: "ASC" } }
  )
  // แยก workflow ต่อกลุ่ม: กลุ่มที่ล้มไม่ทำให้กลุ่มอื่นค้าง (รอบถัดไปลองใหม่)
  for (const group of groups) {
    const workflow =
      expiredGroupOutcome(group.campaign, group) === "succeeded" ? succeedGroupWorkflow : failGroupWorkflow
    try {
      await workflow(container).run({ input: { group_id: group.id } })
    } catch (error) {
      logger.error(`group-buy-deadline: failed to settle group ${group.id}: ${(error as Error).message}`)
    }
  }

  const { data: campaigns } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "group_buy_campaign",
    fields: ["id", "campaign.ends_at"],
    filters: { status: "active" },
  })
  for (const campaign of campaigns.filter((c) => isCampaignExpired(c.campaign?.ends_at, now))) {
    try {
      await setGroupBuyCampaignStatusWorkflow(container).run({ input: { id: campaign.id, status: "ended" } })
    } catch (error) {
      logger.error(`group-buy-deadline: failed to end campaign ${campaign.id}: ${(error as Error).message}`)
    }
  }
}

export const config = {
  name: "group-buy-deadline",
  schedule: "* * * * *",
}
