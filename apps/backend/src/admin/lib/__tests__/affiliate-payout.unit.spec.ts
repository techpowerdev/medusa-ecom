import { AdminCreatePayout, AdminMarkPayoutPaid } from "../../../api/admin/affiliate/validators"
import {
  canCancelPayout,
  canMarkPaid,
  defaultPayoutPeriod,
  markPaidBody,
  mergeAffiliateOptions,
  mergeAffiliatePages,
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

// ADM-9 (spec 08 กฎ 5, AC-12): ตามเวลาเครื่องของแอดมิน (เครื่องตั้งเวลาไทย) — test สร้าง Date แบบ local จึงไม่ขึ้นกับ TZ ของ CI
describe("defaultPayoutPeriod", () => {
  it("is the previous month in device time [1st 00:00, 1st of this month 00:00)", () => {
    expect(defaultPayoutPeriod(new Date(2026, 9, 28, 12))).toEqual({
      period_from: new Date(2026, 8, 1, 0, 0),
      period_to: new Date(2026, 9, 1, 0, 0),
    })
  })

  it("uses the device date right after local midnight on the 1st", () => {
    expect(defaultPayoutPeriod(new Date(2026, 10, 1, 0, 30))).toEqual({
      period_from: new Date(2026, 9, 1, 0, 0),
      period_to: new Date(2026, 10, 1, 0, 0),
    })
  })

  it("wraps to December of the previous year in January", () => {
    expect(defaultPayoutPeriod(new Date(2027, 0, 15))).toEqual({
      period_from: new Date(2026, 11, 1, 0, 0),
      period_to: new Date(2027, 0, 1, 0, 0),
    })
  })
})

describe("toPayoutBody", () => {
  const period_from = new Date("2026-08-31T17:00:00.000Z")
  const period_to = new Date("2026-09-30T17:00:00.000Z")
  const form = { affiliate_id: "aff_1", period_from, period_to }

  it("sends the Dates from DatePicker and passes the AF-5 validator", () => {
    const result = toPayoutBody(form)
    expect(result).toEqual({ body: form })
    expect(AdminCreatePayout.safeParse("body" in result && result.body).success).toBe(true)
  })

  it("requires an affiliate", () => {
    expect(toPayoutBody({ ...form, affiliate_id: "" })).toEqual({
      error: "Select an affiliate",
      field: "affiliate_id",
    })
  })

  it("requires both dates and period_to after period_from", () => {
    expect(toPayoutBody({ ...form, period_from: null })).toMatchObject({
      error: "From is required",
      field: "period_from",
    })
    expect(toPayoutBody({ ...form, period_to: null })).toMatchObject({
      error: "To is required",
      field: "period_to",
    })
    expect(toPayoutBody({ ...form, period_to: period_from })).toEqual({
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

// ADM-17 (spec 08 กฎ 21): useComboboxData ดึงทีละหน้าด้วย q — active/suspended ยิงด้วย offset เดียวกันแล้วรวมเป็นหน้าเดียว
describe("mergeAffiliatePages", () => {
  const aff = (id: string, name: string, status: "active" | "suspended") => ({ id, name, email: `${id}@x.com`, status })
  const page = (affiliates: ReturnType<typeof aff>[], count: number, offset = 0) => ({ affiliates, count, offset, limit: 10 })

  it("merges both pages and keeps paging until the longer list is exhausted", () => {
    const merged = mergeAffiliatePages(page([aff("a", "Bee", "active")], 25, 10), page([aff("s", "Ann", "suspended")], 3, 10))
    expect(merged).toEqual({
      affiliates: [aff("s", "Ann", "suspended"), aff("a", "Bee", "active")],
      count: 25,
      offset: 10,
      limit: 10,
    })
  })

  it("has no next page once both lists fit (count <= offset + limit)", () => {
    const merged = mergeAffiliatePages(page([], 0), page([aff("s", "Ann", "suspended")], 1))
    expect(merged.count).toBeLessThanOrEqual(merged.offset + merged.limit)
    expect(merged.affiliates).toHaveLength(1)
  })
})
