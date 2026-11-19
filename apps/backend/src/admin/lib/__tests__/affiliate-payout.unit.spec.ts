import { readFileSync } from "fs"
import { join } from "path"
import { AdminCreatePayout, AdminListAffiliates, AdminMarkPayoutPaid } from "../../../api/admin/affiliate/validators"
import {
  affiliateOptionsQuery,
  canCancelPayout,
  canMarkPaid,
  defaultPayoutPeriod,
  markPaidBody,
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

// ADM-24 (spec 08 กฎ 28b): ตัวเลือก affiliate ของฟอร์ม payout = request เดียวต่อหน้า (active + suspended) เรียงชื่อฝั่ง server
describe("affiliateOptionsQuery", () => {
  it("adds status active+suspended, order=name and fields to the useComboboxData params", () => {
    expect(affiliateOptionsQuery({ q: "ann", limit: 10, offset: 20 })).toEqual({
      q: "ann",
      limit: 10,
      offset: 20,
      status: ["active", "suspended"],
      order: "name",
      fields: "id,name,email,status",
    })
  })

  it("is accepted by the AdminListAffiliates validator (status as an array)", () => {
    const parsed = AdminListAffiliates.safeParse(affiliateOptionsQuery({ id: "aff_1", limit: 1 }))
    expect(parsed.success).toBe(true)
  })
})

// ADM-24 (spec 08 กฎ 28a, API routes): status ค่าเดียวหรือ array; ค่านอก enum → 400
describe("AdminListAffiliates status", () => {
  it("accepts a single status or an array of statuses", () => {
    expect(AdminListAffiliates.parse({ status: "active" }).status).toEqual("active")
    expect(AdminListAffiliates.parse({ status: ["active", "suspended"] }).status).toEqual(["active", "suspended"])
  })

  it("rejects values outside the enum", () => {
    expect(AdminListAffiliates.safeParse({ status: ["foo"] }).success).toBe(false)
    expect(AdminListAffiliates.safeParse({ status: ["active", "foo"] }).success).toBe(false)
    expect(AdminListAffiliates.safeParse({ status: "foo" }).success).toBe(false)
  })
})

// ADM-24 (spec 08 AC-29 static, กฎ 28b–d)
describe("ADM-24 static", () => {
  const src = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8")

  it("payout-form ไม่รวมผลสองสถานะฝั่ง client และ 401 → throw ให้ ErrorBoundary พาไป /login", () => {
    const form = src("components/affiliate/payout-form.tsx")
    expect(form).not.toMatch(/mergeAffiliatePages|listAffiliatesByStatus/)
    expect(form).toMatch(/if \(isUnauthorized\(options\.error\)\) \{\s*throw options\.error/)
    expect(src("lib/affiliate-payout.ts")).not.toMatch(/mergeAffiliate/)
  })

  it("comment เหนือ tiebreakById เตือนว่าไม่แก้ req.listConfig.order", () => {
    const middlewares = src("../api/admin/affiliate/middlewares.ts")
    const head = middlewares.slice(0, middlewares.indexOf("const tiebreakById"))
    const comment = head.slice(head.lastIndexOf("\n\n"))
    expect(comment).toMatch(/listConfig/)
  })
})
