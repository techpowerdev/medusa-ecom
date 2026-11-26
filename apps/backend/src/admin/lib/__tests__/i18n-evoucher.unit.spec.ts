// spec 10 (AI18N-3): ข้อความของกลุ่ม e-voucher + widget order/variant/refund-blocked (`ecom-evoucher`) แปลตามภาษาที่เลือก
// AC-3 (enum กฎ 7), AC-4a (ตัวแทน e-voucher: poolFormSchema ที่ไม่เลือก partner), AC-7 (ค่า en = ข้อความเดิม)
// jest ตั้ง instance แยก lng=en ไว้ที่ `src/admin/__tests__/i18n-setup.ts` (กฎ 16) — test ที่เปลี่ยนภาษาคืนเป็น en ใน afterEach
import { readFileSync } from "fs"
import { join } from "path"

import { OrderChangeType } from "@medusajs/framework/utils"
import { getI18n } from "react-i18next"

import { ACTIVE_ORDER_CHANGE_REFUND_MESSAGE } from "../../../api/admin/payments/middlewares"
import { type Resources, THAI, keyIssues, missingEnumKeys } from "../../__tests__/i18n-check"
import resources from "../../i18n"
import { allocateErrorMessage, allocateResultToast } from "../evoucher-allocate"
import { httpUrlMessage, PARTNER_PARSE_OPTIONS, partnerFormSchema } from "../evoucher-partner-form"
import { deletePoolPrompt } from "../evoucher-pool-delete"
import { POOL_FORM_DEFAULTS, POOL_PARSE_OPTIONS, poolFormSchema } from "../evoucher-pool-form"
import { resendErrorMessage } from "../evoucher-resend"
import { CODE_STATUSES } from "../evoucher-status"
import { ACTIVE_ORDER_CHANGE_STATUSES, activeChangeType, refundBlockedMessage } from "../order-refund-blocked"

const NS = "ecom-evoucher"
const ADMIN_DIR = join(__dirname, "../..")
const th = resources.th[NS] as Record<string, unknown>
const thAt = (key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], th)

/** ไฟล์ .tsx ของกลุ่ม (component ที่ guard กฎ 14 จับข้อความได้ไม่ครบ — เช่น `header` ของคอลัมน์) */
const GROUP_TSX = [
  "routes/evouchers/page.tsx",
  "routes/evouchers/pools/[id]/page.tsx",
  "components/evoucher/codes-table.tsx",
  "components/evoucher/import-codes.tsx",
  "components/evoucher/partners-section.tsx",
  "components/evoucher/pool-delete.tsx",
  "components/evoucher/pools-table.tsx",
  "widgets/order-evouchers.tsx",
  "widgets/variant-evoucher-pool.tsx",
  "widgets/order-refund-blocked.tsx",
]
const read = (file: string) => readFileSync(join(ADMIN_DIR, file), "utf8")

const poolErrors = () => {
  const parsed = poolFormSchema.safeParse(POOL_FORM_DEFAULTS, POOL_PARSE_OPTIONS)
  expect(parsed.success).toBe(false)
  return Object.fromEntries(parsed.error!.issues.map((i) => [i.path.join("."), i.message]))
}

afterEach(async () => {
  await getI18n().changeLanguage("en")
})

describe("AC-4a ตัวแทน e-voucher: poolFormSchema ที่ไม่เลือก partner", () => {
  it("en = ข้อความเดิม, th = ค่าไทย, de → en (ข้อความ lazy เรียกตอน parse)", async () => {
    expect(poolErrors().partner_id).toBe("Select a partner")
    await getI18n().changeLanguage("th")
    expect(poolErrors().partner_id).toBe(thAt("pool.errors.partner"))
    expect(poolErrors().partner_id).toMatch(THAI)
    await getI18n().changeLanguage("de")
    expect(poolErrors().partner_id).toBe("Select a partner")
  })

  it("ข้อความ validation อื่นของฟอร์ม pool/partner เปลี่ยนตามภาษา (zod lazy + fieldErrorMap แบบ function)", async () => {
    const partner = () =>
      partnerFormSchema.safeParse({ name: " ", logo_url: "ftp://x", terms_url: "", support_contact: "" }, PARTNER_PARSE_OPTIONS)
    const before = partner().error!.issues.map((i) => i.message)
    expect(before).toEqual(["Name is required", "Must be an http:// or https:// URL"])
    expect(httpUrlMessage()).toBe("Must be an http:// or https:// URL")
    const face = () => poolFormSchema.safeParse({ ...POOL_FORM_DEFAULTS, face_value: "-1" }, POOL_PARSE_OPTIONS).error!.issues
    expect(face().find((i) => i.path[0] === "face_value")?.message).toBe("Must be a number of 0 or more")
    await getI18n().changeLanguage("th")
    partner().error!.issues.forEach((i) => expect(i.message).toMatch(THAI))
    Object.values(poolErrors()).forEach((message) => expect(message).toMatch(THAI))
    expect(face().find((i) => i.path[0] === "face_value")?.message).toMatch(THAI)
  })
})

describe("ข้อความจาก lib ของกลุ่ม (กฎ 4b, 8)", () => {
  it("ข้อความที่ admin สร้างแปลตามภาษา ข้อความจาก backend คงเดิม", async () => {
    const stuck = {
      allocated_line_item_ids: [],
      backordered_line_item_ids: ["a"],
      stuck_line_item_ids: ["b"],
    }
    const prompt = deletePoolPrompt({ name: "Starbucks 500", total_codes: 6 })
    expect(prompt.title).toBe("Delete Starbucks 500?")
    await getI18n().changeLanguage("th")
    expect(allocateResultToast(stuck).message).toMatch(THAI)
    expect(allocateErrorMessage(new Error(" "))).toMatch(THAI)
    expect(resendErrorMessage(new Error(""))).toMatch(THAI)
    const thPrompt = deletePoolPrompt({
      name: "Starbucks 500",
      total_codes: 6,
    })
    for (const text of Object.values(thPrompt)) expect(text).toMatch(THAI)
    expect(thPrompt.title).toContain("Starbucks 500")
    expect(thPrompt.description).toContain("6")
    // ข้อความจาก API แสดงตามที่ได้รับ (กฎ 8)
    expect(allocateErrorMessage(new Error("Cannot allocate e-voucher codes for a canceled order"))).toBe(
      "Cannot allocate e-voucher codes for a canceled order",
    )
  })

  it("AC-7: refundBlockedMessage ค่า en = ถ้อยคำของ middleware PAY-8; th เป็นไทย; activeChangeType แปลชนิด change", async () => {
    expect(refundBlockedMessage()).toBe(
      "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first.",
    )
    expect(ACTIVE_ORDER_CHANGE_REFUND_MESSAGE).toContain("active return, claim, exchange or edit. Confirm or cancel it first.")
    expect(activeChangeType({ change_type: "return_request", status: "pending" })).toBe("return request")
    expect(activeChangeType({ change_type: "some_new_type", status: "pending" })).toBe("some new type")
    await getI18n().changeLanguage("th")
    expect(refundBlockedMessage()).toMatch(THAI)
    expect(activeChangeType({ change_type: "return_request", status: "pending" })).toMatch(THAI)
    expect(activeChangeType({ change_type: null, status: "pending" })).toMatch(THAI)
    // ค่าที่ไม่รู้จักแสดงค่าดิบ (กฎ 7)
    expect(activeChangeType({ change_type: "some_new_type", status: "pending" })).toBe("some new type")
  })
})

describe("enum ของกลุ่มมี key ครบ (AC-3, กฎ 7)", () => {
  it.each([
    ["codeStatus", CODE_STATUSES],
    ["orderChangeStatus", ACTIVE_ORDER_CHANGE_STATUSES],
    ["refundBlocked.changeType", Object.values(OrderChangeType)],
  ] as const)("%s", (prefix, values) => {
    expect(values.length).toBeGreaterThan(0)
    expect(missingEnumKeys(resources as Resources, NS, prefix, values)).toEqual([])
  })
})

it("keyIssues: helper ที่ key เป็น template (enum) ไม่ถูกตีเป็น key ไม่รู้ namespace; key literal ที่ไม่มียังถูกจับ", () => {
  const res = resources as Resources
  const src = `import { t } from "../i18n/t"\nexport const f = (v: string) => [t("ecom-evoucher", \`codeStatus.\${v}\`, { defaultValue: v }), t("ecom-evoucher", "nope.key")]`
  expect(keyIssues("lib/x.ts", src, res)).toEqual(["ecom-evoucher:nope.key"])
})

describe("component ของกลุ่มใช้ namespace ecom-evoucher (กฎ 4a, 10)", () => {
  it.each(GROUP_TSX)("%s", (file) => {
    const src = read(file)
    expect(src).toMatch(/useTranslation\("ecom-evoucher"\)|from "(\.\.\/)+i18n\/t"/)
    // ข้อความที่ guard กฎ 14 ไม่ตรวจ: header ของคอลัมน์ / aria-label / label ของ field helper
    expect(src).not.toMatch(/header: "[A-Za-z]/)
    expect(src).not.toMatch(/aria-label="[A-Za-z]/)
    expect(src).not.toMatch(/field\("\w+", "[A-Za-z]/)
  })
})
