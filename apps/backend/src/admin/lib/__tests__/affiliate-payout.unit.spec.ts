import { AdminCreatePayout, AdminMarkPayoutPaid } from "../../../api/admin/affiliate/validators"
import {
  canCancelPayout,
  canMarkPaid,
  defaultPayoutPeriod,
  markPaidBody,
  mergeAffiliateOptions,
  toPayoutBody,
} from "../affiliate-payout"

// AF-6 (spec 05 AC-26): ปุ่มยกเลิกเฉพาะ payout `draft`
describe("canCancelPayout", () => {
  it("is true only for draft payouts", () => {
    expect(canCancelPayout({ status: "draft" })).toBe(true)
    expect(canCancelPayout({ status: "paid" })).toBe(false)
  })
})

// AF-12c (spec 05 กฎ 37c, AC-44)
describe("canMarkPaid", () => {
  it("is true only for draft payouts", () => {
    expect(canMarkPaid({ status: "draft" })).toBe(true)
    expect(canMarkPaid({ status: "paid" })).toBe(false)
  })
})

describe("defaultPayoutPeriod", () => {
  it("is the previous month in Thai time [1st 00:00, 1st of this month 00:00)", () => {
    expect(defaultPayoutPeriod(new Date("2026-10-28T05:00:00Z"))).toEqual({
      period_from: "2026-09-01",
      period_to: "2026-10-01",
    })
  })

  it("uses the Thai date, not UTC (Oct 31 18:00 UTC is already Nov 1 in Bangkok)", () => {
    expect(defaultPayoutPeriod(new Date("2026-10-31T18:00:00Z"))).toEqual({
      period_from: "2026-10-01",
      period_to: "2026-11-01",
    })
  })

  it("wraps to December of the previous year in January", () => {
    expect(defaultPayoutPeriod(new Date("2027-01-15T00:00:00Z"))).toEqual({
      period_from: "2026-12-01",
      period_to: "2027-01-01",
    })
  })
})

describe("toPayoutBody", () => {
  const form = { affiliate_id: "aff_1", period_from: "2026-09-01", period_to: "2026-10-01" }

  it("sends dates as ISO at 00:00 Asia/Bangkok and passes the AF-5 validator", () => {
    const result = toPayoutBody(form)
    expect(result).toEqual({
      body: {
        affiliate_id: "aff_1",
        period_from: "2026-08-31T17:00:00.000Z",
        period_to: "2026-09-30T17:00:00.000Z",
      },
    })
    expect(AdminCreatePayout.safeParse("body" in result && result.body).success).toBe(true)
  })

  it("requires an affiliate", () => {
    expect(toPayoutBody({ ...form, affiliate_id: "" })).toEqual({
      error: "Select an affiliate",
      field: "affiliate_id",
    })
  })

  it("requires both dates and period_to after period_from", () => {
    expect(toPayoutBody({ ...form, period_from: "" })).toMatchObject({ field: "period_from" })
    expect(toPayoutBody({ ...form, period_to: "2026-09-01" })).toEqual({
      error: "To must be after From",
      field: "period_to",
    })
  })
})

describe("markPaidBody", () => {
  it("sends the trimmed reference", () => {
    expect(markPaidBody("  TRX-AC44 ")).toEqual({ reference: "TRX-AC44" })
  })

  it("omits the reference key when empty or whitespace (validator is min(1).optional())", () => {
    for (const value of ["", "   "]) {
      const body = markPaidBody(value)
      expect(body).toEqual({})
      expect("reference" in body).toBe(false)
      expect(AdminMarkPayoutPaid.safeParse(body).success).toBe(true)
    }
    expect(AdminMarkPayoutPaid.safeParse({ reference: "" }).success).toBe(false)
  })
})

describe("mergeAffiliateOptions", () => {
  it("combines the active and suspended lists, de-duplicated by id and sorted by name", () => {
    const a = { id: "aff_a", name: "Bee", email: "b@x.com", status: "active" as const }
    const s = { id: "aff_s", name: "Ann", email: "a@x.com", status: "suspended" as const }
    expect(mergeAffiliateOptions([a], [s, { ...a, status: "suspended" }])).toEqual([s, a])
  })
})
