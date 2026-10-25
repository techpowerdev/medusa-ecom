import { MedusaError } from "@medusajs/framework/utils"
import type { GroupBuyCampaignStatus } from "./campaign-status"

export type GroupCreationCheck = {
  campaignStatus: GroupBuyCampaignStatus
  startsAt: Date | null
  endsAt: Date | null
  now: Date
  groupMode: "pool" | "team" | "both"
  kind: "pool" | "team"
  customerId?: string | null
}

// spec 04 createGroupWorkflow ขั้น 2 + กฎข้อ 10/11:
// แคมเปญต้อง active และอยู่ในช่วงเวลาของ Medusa campaign → มิฉะนั้น NOT_ALLOWED (400)
// mode ไม่ตรงกับ kind → FORBIDDEN (403)
export function assertGroupCreatable({
  campaignStatus,
  startsAt,
  endsAt,
  now,
  groupMode,
  kind,
  customerId,
}: GroupCreationCheck): void {
  if (campaignStatus !== "active") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Groups can only be created on an active group buy campaign (status: ${campaignStatus})`
    )
  }
  const t = now.getTime()
  if ((startsAt && startsAt.getTime() > t) || !endsAt || endsAt.getTime() <= t) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The group buy campaign is outside its active time window"
    )
  }
  if (groupMode !== "both" && groupMode !== kind) {
    throw new MedusaError(
      MedusaError.Types.FORBIDDEN,
      `This campaign does not allow ${kind} groups (group_mode: ${groupMode})`
    )
  }
  if (kind === "team" && !customerId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "customer_id is required for a team group")
  }
}
