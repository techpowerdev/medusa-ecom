import { MedusaError } from "@medusajs/framework/utils"

export type GroupBuyCampaignStatus = "draft" | "active" | "ended"

// spec 04 กฎข้อ 10: draft → active → ended; ended เป็นสถานะสุดท้าย
const NEXT_STATUS: Record<GroupBuyCampaignStatus, GroupBuyCampaignStatus | null> = {
  draft: "active",
  active: "ended",
  ended: null,
}

// เมื่อ active แก้ได้เฉพาะ field เหล่านี้ (spec 04 updateGroupBuyCampaignWorkflow)
const ACTIVE_EDITABLE_FIELDS = new Set(["name", "pay_within_hours"])

const notAllowed = (message: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, message)

export function resolveCampaignStatusTransition(
  from: GroupBuyCampaignStatus,
  to: GroupBuyCampaignStatus
): "noop" | "transition" {
  if (from === to) {
    return "noop"
  }
  if (NEXT_STATUS[from] !== to) {
    throw notAllowed(`Group buy campaign status cannot change from ${from} to ${to}`)
  }
  return "transition"
}

export function assertCampaignPatchAllowed(
  status: GroupBuyCampaignStatus,
  patch: Record<string, unknown>
): void {
  if (status === "draft") {
    return
  }
  if (status === "ended") {
    throw notAllowed("An ended group buy campaign cannot be edited")
  }
  const locked = Object.keys(patch).filter((field) => !ACTIVE_EDITABLE_FIELDS.has(field))
  if (locked.length) {
    throw notAllowed(
      `Only name and pay_within_hours can be edited on an active campaign (got: ${locked.join(", ")})`
    )
  }
}

export function assertCampaignActivatable({
  hasTemplateApplicationMethod,
  endsAt,
  now,
}: {
  hasTemplateApplicationMethod: boolean
  endsAt: Date | null | undefined
  now: Date
}): void {
  if (!hasTemplateApplicationMethod) {
    throw notAllowed("The campaign has no template promotion with an application method")
  }
  if (!endsAt || endsAt.getTime() <= now.getTime()) {
    throw notAllowed("The Medusa campaign must have an ends_at in the future")
  }
}
