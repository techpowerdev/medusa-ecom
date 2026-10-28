import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GROUP_BUY_MODULE } from "../modules/group_buy"
import type GroupBuyModuleService from "../modules/group_buy/service"
import {
  deadlineBatchSkip,
  deadlineSettleLogLevel,
  expiredGroupOutcome,
  isCampaignExpired,
} from "../modules/group_buy/utils/group-outcome"
import { setGroupBuyCampaignStatusWorkflow } from "../workflows/group-buy/campaign-status"
import { failGroupWorkflow, succeedGroupWorkflow } from "../workflows/group-buy/group-outcome"
import { expireGroupBuyMembershipPaymentWorkflow } from "../workflows/group-buy/membership-payment"

// spec 04 Non-functional: ≤ 50 กลุ่มต่อรอบ
const BATCH = 50

// spec 04 scheduled job (GB-4): กลุ่ม open ที่ ends_at <= now → succeed/fail ตามเป้าหมาย (AC-3, AC-11, AC-12)
// และแคมเปญ active ที่ ends_at ของ Medusa campaign ผ่านไปแล้ว → ended (AC-22)
// และ membership awaiting_payment ที่กลุ่มเลย pay_deadline_at → ยกเลิก + อีเมลหมดเวลา (GB-5, AC-10)
export default async function groupBuyDeadlineJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
  const now = new Date()

  const filters = { status: "open" as const, ends_at: { $lte: now } }
  const tick = Math.floor(now.getTime() / 60_000)
  const [, groupCount] = await service.listAndCountGroupBuyGroups(filters, { select: ["id"], take: 1 })
  const groups = await service.listGroupBuyGroups(filters, {
    relations: ["campaign"],
    take: BATCH,
    skip: deadlineBatchSkip(groupCount, BATCH, tick),
    order: { ends_at: "ASC" },
  })
  // แยก workflow ต่อกลุ่ม: กลุ่มที่ล้มไม่ทำให้กลุ่มอื่นค้าง (รอบถัดไปลองใหม่)
  // ผลที่เลือกจาก snapshot นี้ถูกตรวจซ้ำใต้ lock ของกลุ่ม (at_deadline) — ไม่ตรงแล้ว workflow ไม่ทำอะไร
  for (const group of groups) {
    const workflow =
      expiredGroupOutcome(group.campaign, group) === "succeeded" ? succeedGroupWorkflow : failGroupWorkflow
    try {
      await workflow(container).run({ input: { group_id: group.id, at_deadline: true } })
    } catch (error) {
      logger[deadlineSettleLogLevel(error)](
        `group-buy-deadline: failed to settle group ${group.id}: ${(error as Error).message}`
      )
    }
  }

  // GB-5: ตรวจซ้ำใต้ lock ของ membership ใน workflow (ข้าม order ที่มีเงินเข้าแล้ว)
  const expiredFilters = { status: "awaiting_payment" as const, group: { pay_deadline_at: { $lte: now } } }
  const [, expiredCount] = await service.listAndCountGroupBuyMemberships(expiredFilters, { select: ["id"], take: 1 })
  const expired = await service.listGroupBuyMemberships(expiredFilters, {
    select: ["id"],
    take: BATCH,
    skip: deadlineBatchSkip(expiredCount, BATCH, tick),
    order: { joined_at: "ASC" },
  })
  for (const membership of expired) {
    try {
      await expireGroupBuyMembershipPaymentWorkflow(container).run({ input: { membership_id: membership.id } })
    } catch (error) {
      logger.error(`group-buy-deadline: failed to expire membership ${membership.id}: ${(error as Error).message}`)
    }
  }

  // ends_at อยู่ที่ Medusa campaign (link) กรองใน query ไม่ได้ — หมุนหน้าต่าง batch แบบเดียวกับกลุ่ม
  const [, campaignCount] = await service.listAndCountGroupBuyCampaigns(
    { status: "active" },
    { select: ["id"], take: 1 }
  )
  const { data: campaigns } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "group_buy_campaign",
    fields: ["id", "campaign.ends_at"],
    filters: { status: "active" },
    pagination: {
      take: BATCH,
      skip: deadlineBatchSkip(campaignCount, BATCH, tick),
      order: { created_at: "ASC" },
    },
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
