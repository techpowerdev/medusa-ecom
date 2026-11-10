import { AdminCreatePayout, AdminMarkPayoutPaid } from "../../../api/admin/affiliate/validators"
import {
  canCancelPayout,
  canMarkPaid,
  defaultPayoutPeriod,
  fetchAllAffiliates,
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

// ADM-9 (spec 08 กฎ 11, AC-12): route ไม่มี `q` และ limit สูงสุด 200 — ตัวเลือกของ Combobox ต้องดึงครบทุกหน้า ไม่ตัดที่ 200 เงียบ
describe("fetchAllAffiliates", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `aff_${i}` }))

  it("pages through every result at the route's limit of 200", async () => {
    const all = rows(450)
    const calls: [number, number][] = []
    const result = await fetchAllAffiliates(async (offset, limit) => {
      calls.push([offset, limit])
      return { affiliates: all.slice(offset, offset + limit), count: all.length }
    })
    expect(calls).toEqual([
      [0, 200],
      [200, 200],
      [400, 200],
    ])
    expect(result).toEqual(all)
  })

  it("stops after one request when everything fits", async () => {
    const fetchPage = jest.fn(async () => ({ affiliates: rows(3), count: 3 }))
    expect(await fetchAllAffiliates(fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it("stops on an empty page even if count is stale", async () => {
    const fetchPage = jest.fn(async () => ({ affiliates: [], count: 5 }))
    expect(await fetchAllAffiliates(fetchPage)).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
