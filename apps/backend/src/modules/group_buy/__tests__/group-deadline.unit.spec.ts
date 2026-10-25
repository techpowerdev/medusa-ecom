import { computeGroupEndsAt } from "../utils/group-deadline"

// spec 04 business rule 2: pool → ends_at ของแคมเปญ; team → min(created + team_duration_hours, campaign.ends_at)
describe("computeGroupEndsAt", () => {
  const campaignEndsAt = new Date("2026-11-11T00:00:00.000Z")

  it("uses the campaign ends_at for a pool group", () => {
    expect(
      computeGroupEndsAt({
        kind: "pool",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        campaignEndsAt,
        teamDurationHours: 24,
      })
    ).toEqual(campaignEndsAt)
  })

  it("uses created + team_duration_hours for a team when that is earlier", () => {
    expect(
      computeGroupEndsAt({
        kind: "team",
        createdAt: new Date("2026-11-01T10:00:00.000Z"),
        campaignEndsAt,
        teamDurationHours: 48,
      })
    ).toEqual(new Date("2026-11-03T10:00:00.000Z"))
  })

  it("caps a team deadline at the campaign ends_at", () => {
    expect(
      computeGroupEndsAt({
        kind: "team",
        createdAt: new Date("2026-11-10T12:00:00.000Z"),
        campaignEndsAt,
        teamDurationHours: 24,
      })
    ).toEqual(campaignEndsAt)
  })

  it("falls back to the campaign ends_at when team_duration_hours is not set", () => {
    expect(
      computeGroupEndsAt({
        kind: "team",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        campaignEndsAt,
        teamDurationHours: null,
      })
    ).toEqual(campaignEndsAt)
  })
})
