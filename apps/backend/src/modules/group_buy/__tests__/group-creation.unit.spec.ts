import { MedusaError } from "@medusajs/framework/utils"
import { assertGroupCreatable, type GroupCreationCheck } from "../utils/group-creation"

const HOUR = 60 * 60 * 1000
const now = new Date("2026-11-01T10:00:00.000Z")

const check = (data: Partial<GroupCreationCheck> = {}): GroupCreationCheck => ({
  campaignStatus: "active",
  startsAt: new Date(now.getTime() - HOUR),
  endsAt: new Date(now.getTime() + 10 * HOUR),
  now,
  groupMode: "both",
  kind: "pool",
  customerId: null,
  ...data,
})

const notAllowed = expect.objectContaining({ type: MedusaError.Types.NOT_ALLOWED })
const forbidden = expect.objectContaining({ type: MedusaError.Types.FORBIDDEN })

// spec 04 createGroupWorkflow ขั้น 2 + กฎข้อ 10/11 (AC-19, AC-21b)
describe("assertGroupCreatable", () => {
  it("accepts an active campaign inside its time window", () => {
    expect(() => assertGroupCreatable(check())).not.toThrow()
    expect(() => assertGroupCreatable(check({ startsAt: null }))).not.toThrow()
    expect(() => assertGroupCreatable(check({ startsAt: now }))).not.toThrow()
  })

  it.each(["draft", "ended"] as const)("rejects a %s campaign with NOT_ALLOWED", (status) => {
    expect(() => assertGroupCreatable(check({ campaignStatus: status }))).toThrow(notAllowed)
  })

  it("rejects when the Medusa campaign starts_at is in the future (NOT_ALLOWED)", () => {
    expect(() =>
      assertGroupCreatable(check({ startsAt: new Date(now.getTime() + 1) }))
    ).toThrow(notAllowed)
  })

  it("rejects when the Medusa campaign ends_at is now, in the past or missing (NOT_ALLOWED)", () => {
    expect(() => assertGroupCreatable(check({ endsAt: now }))).toThrow(notAllowed)
    expect(() =>
      assertGroupCreatable(check({ endsAt: new Date(now.getTime() - HOUR) }))
    ).toThrow(notAllowed)
    expect(() => assertGroupCreatable(check({ endsAt: null }))).toThrow(notAllowed)
  })

  it.each([
    ["pool", "team"],
    ["team", "pool"],
  ] as const)("group_mode=%s + kind=%s → FORBIDDEN", (groupMode, kind) => {
    expect(() =>
      assertGroupCreatable(check({ groupMode, kind, customerId: "cus_1" }))
    ).toThrow(forbidden)
  })

  it.each([
    ["pool", "pool"],
    ["both", "pool"],
    ["team", "team"],
    ["both", "team"],
  ] as const)("group_mode=%s allows kind=%s", (groupMode, kind) => {
    expect(() =>
      assertGroupCreatable(check({ groupMode, kind, customerId: "cus_1" }))
    ).not.toThrow()
  })

  it("requires customer_id for a team (INVALID_DATA)", () => {
    expect(() => assertGroupCreatable(check({ kind: "team", customerId: null }))).toThrow(
      expect.objectContaining({ type: MedusaError.Types.INVALID_DATA })
    )
  })

  it("checks status/time before mode (inactive campaign → NOT_ALLOWED even if mode mismatches)", () => {
    expect(() =>
      assertGroupCreatable(
        check({ campaignStatus: "draft", groupMode: "pool", kind: "team", customerId: "cus_1" })
      )
    ).toThrow(notAllowed)
  })
})
