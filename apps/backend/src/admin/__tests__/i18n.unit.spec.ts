// spec 10 (AI18N-1): i18n ของหน้า admin ที่เราเขียนเอง — AC-1 (โครง), AC-2 (parity), AC-3 (key), AC-4 (lazy + instance), AC-5 (guard กฎ 14)
// jest ตั้ง instance แยก lng=en ไว้ที่ `i18n-setup.ts` (กฎ 16) — test ที่เปลี่ยนภาษาคืนเป็น en ใน afterEach
import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"

import i18next from "i18next"
import { getI18n } from "react-i18next"

import resources from "../i18n"
import { t } from "../i18n/t"
import { fieldErrorMap } from "../lib/form-validation"
import {
  type Json,
  type Resources,
  RETURN_ALLOWLIST,
  THAI,
  dashboardTranslations,
  guardIssues,
  keyIssues,
  missingEnumKeys,
  parityIssues,
  unionLiterals,
} from "./i18n-check"

const ADMIN_DIR = join(__dirname, "..")
const NAMESPACES = ["ecom-common", "ecom-group-buy", "ecom-evoucher", "ecom-affiliate"] as const
const LANGS = ["en", "th"] as const

// กฎ 14: ไฟล์ที่ยังไม่แปล — task ของกลุ่มลบไฟล์ของตัวเอง (แต่ละ key คนละบรรทัด คั่นด้วยบรรทัด comment ที่ไม่เปลี่ยน กัน conflict ตอน stack)
// ไฟล์ของกลุ่มที่ guard ไม่พบข้อความฮาร์ดโค้ดไม่อยู่ในรายการ (test "ลืมลบ" ด้านล่างจะล้ม) แต่ task ของกลุ่มยังต้องตรวจข้อความที่ guard จับไม่ได้เอง
const I18N_PENDING: Record<"groupBuy" | "evoucher" | "affiliate", string[]> = {
  // ---- AI18N-2 (ecom-group-buy) ----
  // ไม่อยู่ในรายการแต่ต้องตรวจเอง: lib/group-buy-campaign.ts (`(deleted)`, หน่วยของ target), lib/group-buy.ts (enum สถานะ — กฎ 7)
  groupBuy: [],
  // ---- AI18N-3 (ecom-evoucher) ----
  // ไม่อยู่ในรายการแต่ต้องตรวจเอง: lib/evoucher{,-query,-status}.ts (enum `CODE_STATUSES` — กฎ 7)
  evoucher: [],
  // ---- AI18N-4 (ecom-affiliate) ----
  // ไม่อยู่ในรายการแต่ต้องตรวจเอง: lib/affiliate{,-names}.ts (enum สถานะ — กฎ 7)
  affiliate: [],
  // ---- จบรายการ ----
}
const PENDING = Object.values(I18N_PENDING).flat()

/** ไฟล์ที่ `new Error(...)` ถูกนำไปแสดงต่อผู้ใช้ (กฎ 14c) — ยังไม่มี */
const ERROR_SHOWN_TO_USER: string[] = []

/** key ของ th ที่คงละตินได้ (กฎ 5) ต่อ namespace */
const LATIN_KEYS: Record<string, string[]> = {}

// ไฟล์ .ts/.tsx ของ src/admin (ยกเว้น test) เป็น path สัมพัทธ์
const adminFiles = (readdirSync(ADMIN_DIR, { recursive: true }) as string[])
  .map((f) => f.split("\\").join("/"))
  .filter((f) => /\.tsx?$/.test(f) && !f.split("/").includes("__tests__") && !f.endsWith(".d.ts"))
const read = (file: string) => readFileSync(join(ADMIN_DIR, file), "utf8")
const jsonOf = (lng: string, ns: string) => join(ADMIN_DIR, "i18n/json", lng, `${ns}.json`)

describe("โครง src/admin/i18n (AC-1, กฎ 1–2)", () => {
  it("default export มี en/th และแต่ละภาษามี namespace ตรง 4 ตัว ไม่มี translation", () => {
    expect(Object.keys(resources).sort()).toEqual(["en", "th"])
    for (const lng of LANGS) {
      expect(Object.keys(resources[lng]).sort()).toEqual([...NAMESPACES].sort())
      expect(resources[lng]).not.toHaveProperty("translation")
    }
  })

  it.each(LANGS.flatMap((lng) => NAMESPACES.map((ns) => [lng, ns])))("json/%s/%s.json มีอยู่และ parse ได้", (lng, ns) => {
    expect(existsSync(jsonOf(lng, ns))).toBe(true)
    expect(JSON.parse(readFileSync(jsonOf(lng, ns), "utf8"))).toEqual(resources[lng as "en"][ns as "ecom-common"])
  })

  it("import JSON ด้วย with { type: \"json\" } (กฎ 1)", () => {
    const src = read("i18n/index.ts")
    const imports = src.match(/^import .* from "\.\/json\/.*$/gm) ?? []
    expect(imports).toHaveLength(8)
    imports.forEach((line) => expect(line).toMatch(/ with \{ type: "json" \}$/))
  })
})

describe("parity en/th (AC-2, กฎ 5)", () => {
  it.each([...NAMESPACES])("%s: key/{{var}} ตรงกันและค่า th มีอักษรไทย", (ns) => {
    expect(parityIssues(resources.en[ns] as Json, resources.th[ns] as Json, LATIN_KEYS[ns])).toEqual([])
  })

  it("fixture: ลบ key จาก th → คืน key นั้น; plural en _one/_other กับ th _other เท่ากัน; {{var}} ต่างกัน → ล้ม", () => {
    const en = { a: { b: "Leave", c: "{{n}} items_x" }, items_one: "{{count}} item", items_other: "{{count}} items" }
    const th = { a: { b: "ออก", c: "{{n}} รายการ" }, items_other: "{{count}} รายการ" }
    expect(parityIssues(en, th)).toEqual([])
    expect(parityIssues(en, { ...th, a: { c: "{{n}} รายการ" } })).toEqual(["ไม่มีใน th: a.b"])
    expect(parityIssues(en, { ...th, a: { b: "ออก", c: "{{m}} รายการ" } })).toEqual(["{{var}} ไม่ตรง: a.c"])
    expect(parityIssues(en, { ...th, a: { b: "Leave", c: "{{n}} รายการ" } })).toEqual(["th ไม่มีอักษรไทย: a.b"])
    expect(parityIssues(en, { ...th, a: { b: "Leave", c: "{{n}} รายการ" } }, ["a.b"])).toEqual([])
  })
})

describe("key ที่ใช้ในโค้ดมีจริง (AC-3, กฎ 4a, 6, 7)", () => {
  it.each(adminFiles)("%s", (file) => {
    expect(keyIssues(file, read(file), resources as Resources)).toEqual([])
  })

  it("prompt ออกจากฟอร์มใช้ key ของ Medusa และ Leave/Continue editing ของ ecom-common", () => {
    const src = read("components/common/use-confirm-discard.ts")
    expect(src).toMatch(/useTranslation\("ecom-common"\)/)
    expect(src).toMatch(/t\("general\.unsavedChangesTitle", \{ ns: "translation" \}\)/)
    expect(src).toMatch(/t\("general\.unsavedChangesDescription", \{ ns: "translation" \}\)/)
    expect(dashboardTranslations("en")["general.unsavedChangesTitle"]).toBe("Are you sure you want to leave this form?")
  })

  it("fixture: key ไม่มีอยู่ → คืน key นั้น; ns translation นอกรายการ/หลาย namespace → ล้ม", () => {
    const res = resources as Resources
    const ok = `const C = () => { const { t } = useTranslation("ecom-common"); return t("confirmDiscard.leave") }`
    expect(keyIssues("components/x.tsx", ok, res)).toEqual([])
    const missing = `const C = () => { const { t } = useTranslation("ecom-common"); return t("nope.key") }`
    expect(keyIssues("components/x.tsx", missing, res)).toEqual(["ecom-common:nope.key"])
    const helper = `import { t } from "../i18n/t"\nexport const f = () => t("ecom-common", "nope.helper")`
    expect(keyIssues("lib/x.ts", helper, res)).toEqual(["ecom-common:nope.helper"])
    const medusa = `const C = () => { const { t } = useTranslation("ecom-common"); return [t("actions.save", { ns: "translation" }), t("actions.foo", { ns: "translation" })] }`
    expect(keyIssues("components/x.tsx", medusa, res)).toEqual(["translation:actions.foo ไม่อยู่ในรายการ MEDUSA_KEYS"])
    const two = `const A = () => useTranslation("ecom-common"); const B = () => useTranslation("ecom-evoucher")`
    expect(keyIssues("components/x.tsx", two, res)).toEqual(["useTranslation หลาย namespace: ecom-common, ecom-evoucher"])
    const route = `export const config = defineRouteConfig({ label: "nav.missing", translationNs: "ecom-common" })`
    expect(keyIssues("routes/x/page.tsx", route, res)).toEqual(["ecom-common:nav.missing"])
  })

  // nit review AI18N-3: helper ที่ key เป็น template (enum — ตรวจด้วย missingEnumKeys) ข้ามได้ แต่ key เป็น identifier ตรวจไม่ได้ → รายงาน
  it("fixture: helper key แบบ template ข้าม, แบบ identifier รายงาน", () => {
    const res = resources as Resources
    const template = `import { t } from "../i18n/t"\nexport const f = (v: string) => t("ecom-common", \`confirmDiscard.\${v}\`)`
    expect(keyIssues("lib/x.ts", template, res)).toEqual([])
    const identifier = `import { t } from "../i18n/t"\nconst KEY = "nope"\nexport const f = () => t("ecom-common", KEY)`
    expect(keyIssues("lib/x.ts", identifier, res)).toEqual(["ecom-common: key ไม่ใช่ literal/template (KEY)"])
  })

  it("fixture enum (กฎ 7): ค่าใหม่ใน array/union ที่ไม่มี key → คืนค่านั้น", () => {
    const res: Resources = { en: { ns: { status: { draft: "Draft", active: "Active" } } }, th: {} }
    expect(missingEnumKeys(res, "ns", "status", ["draft", "active"])).toEqual([])
    expect(missingEnumKeys(res, "ns", "status", ["draft", "active", "ended"])).toEqual(["ended"])
    const src = `export type CampaignStatus = "draft" | "active" | "ended"`
    expect(unionLiterals("lib/x.ts", src, "CampaignStatus")).toEqual(["draft", "active", "ended"])
  })
})

describe("t ตอนรัน + instance แยก (AC-4, กฎ 4, 8, 11, 16)", () => {
  afterEach(async () => {
    await getI18n().changeLanguage("en")
  })

  it("(a) ecom-common: en = ข้อความเดิม, th = ค่าไทย, de → en", async () => {
    expect(t("ecom-common", "confirmDiscard.leave")).toBe("Leave")
    expect(t("ecom-common", "confirmDiscard.continueEditing")).toBe("Continue editing")
    await getI18n().changeLanguage("th")
    expect(t("ecom-common", "confirmDiscard.leave")).toBe(resources.th["ecom-common"].confirmDiscard.leave)
    expect(t("ecom-common", "confirmDiscard.leave")).toMatch(THAI)
    await getI18n().changeLanguage("de")
    expect(t("ecom-common", "confirmDiscard.leave")).toBe("Leave")
  })

  it("(a) fieldErrorMap รับ function ต่อช่องและเรียกตอน parse (กฎ 4d)", async () => {
    const map = fieldErrorMap({ starts_at: () => t("ecom-common", "confirmDiscard.leave"), legacy: "Legacy" })
    expect(map({ path: ["starts_at"] })).toBe("Leave")
    expect(map({ path: ["legacy"] })).toBe("Legacy")
    expect(map({ path: ["other"] })).toBeUndefined()
    await getI18n().changeLanguage("th")
    expect(map({ path: ["starts_at"] })).toMatch(THAI)
  })

  it("(b) instance กลางของ i18next ไม่ถูก init — optionalInt ของ dashboard ยังได้ Invalid input", async () => {
    expect(i18next.isInitialized).toBeFalsy()
    expect(getI18n()).not.toBe(i18next)
    const { optionalInt } = await import("@medusajs/dashboard/lib")
    const parsed = optionalInt.safeParse("1.5")
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toBe("Invalid input")
  })

  it("(c) require ทุก lib/*.ts (ยกเว้น client.ts) และ i18n/t.ts ก่อน init ไม่ throw", () => {
    const libs = readdirSync(join(ADMIN_DIR, "lib")).filter((f) => f.endsWith(".ts") && f !== "client.ts")
    expect(libs.length).toBeGreaterThan(20)
    jest.isolateModules(() => {
      jest.doMock("../lib/client", () => ({ sdk: {} }))
      expect(require("react-i18next").getI18n()).toBeUndefined()
      for (const lib of libs) expect(() => require(join(ADMIN_DIR, "lib", lib))).not.toThrow()
      expect(() => require("../i18n/t")).not.toThrow()
    })
  })

  it("(c) fixture: module ที่เรียก helper t ระดับบนสุด → throw ก่อน init", () => {
    jest.isolateModules(() => {
      expect(() => require("./fixtures/top-level-t")).toThrow(/spec 10 กฎ 4/)
    })
  })
})

describe("guard static (AC-5, กฎ 9, 14)", () => {
  it("I18N_PENDING: ทุกไฟล์มีอยู่จริงและไม่ซ้ำ", () => {
    PENDING.forEach((file) => expect(adminFiles).toContain(file))
    expect(new Set(PENDING).size).toBe(PENDING.length)
  })

  it.each(adminFiles.filter((f) => !f.startsWith("i18n/")))("%s ไม่มีข้อความ UI ฮาร์ดโค้ด / ไม่เรียก t ตอนโหลด", (file) => {
    const issues = guardIssues(file, read(file), {
      pending: PENDING.includes(file),
      errorShownToUser: ERROR_SHOWN_TO_USER.includes(file),
    })
    expect(issues.map((i) => `${i.rule}:${i.line} ${i.text}`)).toEqual([])
  })

  it.each(adminFiles.filter((f) => f.startsWith("i18n/")))("%s ไม่เรียก t ตอนโหลด (f)", (file) => {
    expect(guardIssues(file, read(file), { pending: true })).toEqual([])
  })

  // แบบ ICON_PENDING: แปลแล้วแต่ลืมลบออกจากรายการ → ล้ม (it ธรรมดาเพราะ it.each ไม่รับ array ว่าง)
  it("ไฟล์ใน I18N_PENDING ยังมีข้อความฮาร์ดโค้ด (แปลแล้วต้องลบออกจากรายการ)", () => {
    const clean = PENDING.filter((file) => guardIssues(file, read(file)).every((i) => i.rule === "f" || i.rule === "g"))
    expect(clean).toEqual([])
  })

  const rules = (file: string, src: string, opts = {}) => guardIssues(file, src, opts).map((i) => i.rule)

  it.each([
    ["a", "components/x.tsx", `const C = () => <Text>Hello world</Text>`],
    ["b", "components/x.tsx", `const actions = [{ label: "Edit", onClick }]`],
    ["b", "components/x.tsx", `const C = () => <Header heading="Could not load codes" />`],
    ["b", "components/x.tsx", `const C = () => <Header heading={ok ? "Codes" : "Could not load codes"} />`],
    ["c", "components/x.tsx", `const f = () => toast.success("Saved")`],
    ["c", "components/x.tsx", `const f = () => { throw new FormError("Name is required") }`],
    ["d", "lib/x.ts", `export const s = z.string().min(1, "Select a partner")`],
    ["d", "lib/x.ts", `export const s = z.string().refine(fn, { message: "Name is required" })`],
    ["d", "lib/x.ts", `export const m = fieldErrorMap({ starts_at: "Invalid date" })`],
    ["e", "lib/x.ts", `const INVALID_DATE = "Invalid date"`],
    ["e", "lib/x.ts", "export const required = (label: string) => `${label} is required`"],
    ["e", "lib/x.ts", `export function activeChangeType(type?: string) { if (!type) return "order change"; return type }`],
    ["f", "components/x.tsx", `const X = t("ecom-common", "a")`],
    ["f", "components/x.tsx", `const { t } = useTranslation("ecom-common")`],
    ["g", "routes/x/page.tsx", `export const config = defineRouteConfig({ label: LABEL, translationNs: NS })`],
  ])("fixture (%s) ถูกจับ: %s %s", (rule, file, src) => {
    expect(rules(file, src)).toContain(rule)
  })

  // nit review AI18N-3: RETURN_ALLOWLIST ผูกกับไฟล์ — ค่าที่อนุญาตในไฟล์หนึ่งยังถูกจับในไฟล์อื่น และทุกค่าอยู่ในไฟล์นั้นจริง
  it("RETURN_ALLOWLIST ผูกกับไฟล์: ไฟล์มีอยู่และค่าเป็น literal ในไฟล์นั้น; ไฟล์อื่นคืนค่าเดียวกัน → (e)", () => {
    for (const [file, values] of Object.entries(RETURN_ALLOWLIST)) {
      expect(adminFiles).toContain(file)
      values.forEach((value) => expect(read(file)).toContain(`"${value}"`))
    }
    const src = `export const state = (low: boolean) => (low ? "low" : "ok")`
    expect(rules("lib/x.ts", src)).toEqual(["e", "e"])
    expect(rules("lib/evoucher-pool-delete.ts", src)).toEqual([])
  })

  it("fixture (c) new Error ในไฟล์ที่แสดงต่อผู้ใช้ถูกจับ ไฟล์อื่นไม่จับ", () => {
    const src = `const f = () => { throw new Error("Could not save") }`
    expect(rules("components/x.tsx", src, { errorShownToUser: true })).toEqual(["c"])
    expect(rules("components/x.tsx", src)).toEqual([])
  })

  it("fixture (f) ทำงานกับไฟล์ใน PENDING ด้วย", () => {
    expect(rules("components/x.tsx", `const X = t("ecom-common", "a")`, { pending: true })).toEqual(["f"])
  })

  it.each([
    ["components/x.tsx", `const C = () => { const { t } = useTranslation("ecom-common"); return <Text>{t("x")}</Text> }`],
    ["lib/x.ts", `export const s = z.string().min(1, { error: () => t("ecom-evoucher", "x") })`],
    ["components/x.tsx", `NumberInput.displayName = "NumberInput"`],
    ["lib/x.ts", `export const send = () => request({ method: "POST" })`],
    ["components/x.tsx", `const C = () => <Button variant="secondary" data-testid="gb-save">{t("actions.save", { ns: "translation" })}</Button>`],
    ["routes/x/page.tsx", `export const config = defineRouteConfig({ label: "nav.label", translationNs: "ecom-common", icon: Users })`],
    ["components/x.tsx", `const C = () => <Text>THB</Text>`],
    ["lib/x.ts", "export const path = (id: string) => `/admin/group-buy/campaigns/${id}/groups`"],
  ])("fixture ไม่ถูกจับ: %s %s", (file, src) => {
    expect(guardIssues(file, src)).toEqual([])
  })
})
