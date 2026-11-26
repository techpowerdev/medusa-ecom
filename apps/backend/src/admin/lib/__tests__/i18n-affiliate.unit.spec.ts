// spec 10 (AI18N-4): ข้อความของกลุ่ม affiliate (`ecom-affiliate`) — AC-3 (enum กฎ 7), AC-4a (ตัวแทน `toPayoutBody` + lib อื่นของกลุ่ม)
// jest ตั้ง instance แยก lng=en (`src/admin/__tests__/i18n-setup.ts`, กฎ 16) — test ที่เปลี่ยนภาษาคืนเป็น en ใน afterEach
import { readFileSync } from "fs"
import { join } from "path"

import { getI18n } from "react-i18next"

import { THAI, type Resources, missingEnumKeys, unionLiterals } from "../../__tests__/i18n-check"
import resources from "../../i18n"
import { affiliateAction, PAYOUT_INFO_FIELDS, payoutInfoSchema } from "../affiliate-account"
import { PAYOUT_PARSE_OPTIONS, toPayoutBody } from "../affiliate-payout"
import { emptyProgramForm, PROGRAM_PARSE_OPTIONS, toProgramBody } from "../affiliate-program-form"

const ADMIN_DIR = join(__dirname, "../..")
const read = (file: string) => readFileSync(join(ADMIN_DIR, file), "utf8")
const NS = "ecom-affiliate"
const th = (key: string) =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], resources.th[NS]) as string

const form = { affiliate_id: "", period_from: new Date(2026, 8, 1), period_to: new Date(2026, 9, 1) }
const errorOf = (result: ReturnType<typeof toPayoutBody>) => ("error" in result ? result.error : undefined)

describe("ข้อความ lib ของ affiliate ตามภาษา (AC-4a, กฎ 4, 8, 11)", () => {
  afterEach(async () => {
    await getI18n().changeLanguage("en")
  })

  it("toPayoutBody ไม่เลือก affiliate: en = ข้อความเดิม, th = ค่าไทย, de → en", async () => {
    expect(errorOf(toPayoutBody(form))).toBe("Select an affiliate")
    await getI18n().changeLanguage("th")
    expect(errorOf(toPayoutBody(form))).toBe(th("payoutForm.errors.affiliate"))
    expect(errorOf(toPayoutBody(form))).toMatch(THAI)
    await getI18n().changeLanguage("de")
    expect(errorOf(toPayoutBody(form))).toBe("Select an affiliate")
  })

  it("error ของ toPayoutBody/PAYOUT_PARSE_OPTIONS เป็นไทยเมื่อ lng=th", async () => {
    await getI18n().changeLanguage("th")
    const base = { ...form, affiliate_id: "aff_1" }
    const errors = [
      toPayoutBody({ ...base, period_from: null }),
      toPayoutBody({ ...base, period_to: null }),
      toPayoutBody({ ...base, period_to: base.period_from }),
    ].map(errorOf)
    errors.forEach((e) => expect(e).toMatch(THAI))
    expect(PAYOUT_PARSE_OPTIONS.error({ path: ["period_from"] })).toBe(th("payoutForm.errors.invalidDate"))
  })

  it("toProgramBody: ข้อความประกอบด้วย {{label}} — en เท่าเดิมทุกตัวอักษร, th มีอักษรไทยทุกข้อ", async () => {
    const invalid = { ...emptyProgramForm(), commission_value: "0", attribution_window_days: "0", hold_days: "-1", cap_per_order: "0", all: false }
    const messages = () => {
      const result = toProgramBody(invalid)
      return "errors" in result ? result.errors.map((e) => e.message) : []
    }
    expect(messages()).toEqual([
      "Name is required",
      "Start is required",
      "End is required",
      "Commission must be above 0 and at most 100",
      "Attribution window must be a whole number of at least 1",
      "Hold days must be a whole number of at least 0",
      "Cap per order must be above 0",
      "Select at least one collection or category",
    ])
    expect(PROGRAM_PARSE_OPTIONS.error({ path: ["starts_at"] })).toBe("Start is invalid")
    expect(PROGRAM_PARSE_OPTIONS.error({ path: ["ends_at"] })).toBe("End is invalid")
    await getI18n().changeLanguage("th")
    expect(messages()).toHaveLength(8)
    messages().forEach((m) => expect(m).toMatch(THAI))
    expect(PROGRAM_PARSE_OPTIONS.error({ path: ["starts_at"] })).toMatch(THAI)
    expect(messages()[1]).not.toContain("{{")
  })

  it("affiliateAction / payoutInfoSchema: en เท่าเดิม, th มีอักษรไทย", async () => {
    expect(affiliateAction("pending").label).toBe("Approve")
    const issues = () => payoutInfoSchema.safeParse({ bank_name: "", account_name: "A", account_number: "12" }).error!.issues
    expect(issues().map((i) => i.message)).toEqual(["Required", "Must be 10–12 digits"])
    await getI18n().changeLanguage("th")
    expect(affiliateAction("pending").label).toBe(th("affiliates.actions.approve"))
    ;(["pending", "active", "suspended"] as const).forEach((s) => expect(affiliateAction(s).label).toMatch(THAI))
    issues().forEach((i) => expect(i.message).toMatch(THAI))
  })
})

describe("enum/ค่าคงที่ของกลุ่ม affiliate มี key ครบ (AC-3, กฎ 7)", () => {
  const res = resources as Resources
  const affiliateLib = read("lib/affiliate.ts")

  it.each([
    ["ProgramStatus", "programs.status"],
    ["AffiliateStatus", "affiliates.status"],
    ["CommissionEntryStatus", "ledger.status"],
    ["PayoutStatus", "payouts.status"],
  ])("lib/affiliate.ts %s → %s.*", (typeName, prefix) => {
    const values = unionLiterals("lib/affiliate.ts", affiliateLib, typeName)
    expect(values.length).toBeGreaterThan(1)
    expect(missingEnumKeys(res, NS, prefix, values)).toEqual([])
  })

  it("Resource ของ list-table → list.loadError.*", () => {
    const values = unionLiterals("components/affiliate/list-table.tsx", read("components/affiliate/list-table.tsx"), "Resource")
    expect(values.sort()).toEqual(["affiliates", "entries", "payouts", "programs"])
    expect(missingEnumKeys(res, NS, "list.loadError", values)).toEqual([])
  })

  it("แท็บของหน้า affiliate → tabs.*", () => {
    const src = read("routes/affiliate/page.tsx")
    const values = [...src.slice(src.indexOf("const TABS")).matchAll(/value: "([a-z]+)"/g)].map((m) => m[1])
    expect(values).toEqual(["programs", "affiliates", "ledger", "payouts"])
    expect(missingEnumKeys(res, NS, "tabs", values)).toEqual([])
  })

  it("ช่องของฟอร์ม → payoutInfo.fields.* / programForm.fields.* / payoutForm.fields.*", () => {
    expect(missingEnumKeys(res, NS, "payoutInfo.fields", PAYOUT_INFO_FIELDS)).toEqual([])
    expect(missingEnumKeys(res, NS, "programForm.fields", Object.keys(emptyProgramForm()).filter((k) => k !== "variant_ids"))).toEqual([])
    expect(missingEnumKeys(res, NS, "payoutForm.fields", Object.keys(form))).toEqual([])
  })

  // review AI18N-4: ข้อความที่ตรงกับ key ของ Medusa ใช้ key นั้น (กฎ 6) — ไม่ซ้ำใน ecom-affiliate
  it("ผลค้นหาว่างของตารางใช้ general.noResults* ของ Medusa", () => {
    const src = read("components/affiliate/list-table.tsx")
    expect(src).toContain('heading: t("general.noResultsTitle", { ns: "translation" })')
    expect(src).toContain('description: t("general.noResultsMessage", { ns: "translation" })')
    expect(resources.en[NS].list).not.toHaveProperty("noResults")
    expect(resources.th[NS].list).not.toHaveProperty("noResults")
  })

  it("th: toast หลัง mark paid ไม่ซ้ำกับปุ่มยืนยัน", () => {
    expect(th("markPaid.done")).not.toBe(th("markPaid.confirm"))
    expect(th("markPaid.done")).toMatch(THAI)
  })

  it("ค่า en ของสถานะ = ค่าดิบเดิม (badge แสดงค่า enum ตรงๆ ก่อนแปล)", () => {
    for (const prefix of ["programs", "affiliates", "ledger", "payouts"] as const) {
      const status = resources.en[NS][prefix].status as Record<string, string>
      Object.entries(status).forEach(([value, text]) => expect(text).toBe(value))
    }
  })
})
