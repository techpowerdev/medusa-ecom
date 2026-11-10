const HOUR_MS = 60 * 60 * 1000

export type ComputeGroupEndsAtInput = {
  kind: "pool" | "team"
  createdAt: Date
  campaignEndsAt: Date
  teamDurationHours?: number | null
}

// spec 04 business rule 2: pool → ends_at ของแคมเปญ; team → min(created + team_duration_hours, campaign.ends_at)
export function computeGroupEndsAt({
  kind,
  createdAt,
  campaignEndsAt,
  teamDurationHours,
}: ComputeGroupEndsAtInput): Date {
  if (kind === "pool" || !teamDurationHours) {
    return new Date(campaignEndsAt.getTime())
  }

  const teamEndsAt = createdAt.getTime() + teamDurationHours * HOUR_MS
  return new Date(Math.min(teamEndsAt, campaignEndsAt.getTime()))
}
