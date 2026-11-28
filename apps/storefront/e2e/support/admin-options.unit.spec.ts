import { expect, test } from "@playwright/test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, adminLabel, adminText, pickLabel } from "./admin"
import { BACKEND_URL } from "./fixtures"
import { THAI } from "./thai-text"

// spec 08 กฎ 12 / AC-3 (ADM-2b): e2e admin ทุกไฟล์รันด้วย locale en-US + timezone ไทย
// (useDate/getLocaleAmount ของ Medusa ใช้ timezone/locale ของ browser) — ตั้งที่ ADMIN_UI_OPTIONS ที่เดียว
// spec 10 กฎ 12–13 / AC-6 (AI18N-1): + ล็อกภาษา admin ด้วย cookie/localStorage `lng` ของ origin backend
const E2E_DIR = join(__dirname, "..")
const read = (file: string) => readFileSync(join(E2E_DIR, file), "utf8")
const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts") && !f.endsWith(".unit.spec.ts"))
// ไฟล์ชื่อ admin* (spec 08) ∪ ไฟล์ที่ login admin UI (spec 10 AC-6)
const adminSpecs = specs.filter((f) => /admin.*\.spec\.ts$/.test(f) || /\bloginAdmin\(/.test(read(f)))

test.describe("ADMIN_UI_OPTIONS (spec 08 กฎ 12, spec 10 กฎ 12)", () => {
  test("ตั้ง locale en-US และ timezoneId Asia/Bangkok", () => {
    expect(ADMIN_UI_OPTIONS).toMatchObject({ locale: "en-US", timezoneId: "Asia/Bangkok" })
  })

  test("storageState มี cookie lng=en และ localStorage lng=en ของ origin BACKEND_URL", () => {
    const { origin, hostname } = new URL(BACKEND_URL)
    expect(ADMIN_UI_OPTIONS.storageState.cookies).toEqual([
      expect.objectContaining({ name: "lng", value: "en", domain: hostname, path: "/" }),
    ])
    expect(ADMIN_UI_OPTIONS.storageState.origins).toEqual([{ origin, localStorage: [{ name: "lng", value: "en" }] }])
  })

  test("ADMIN_UI_OPTIONS_TH ต่างจาก ADMIN_UI_OPTIONS เฉพาะค่า lng=th", () => {
    const swap = JSON.parse(JSON.stringify(ADMIN_UI_OPTIONS).replaceAll('"value":"en"', '"value":"th"'))
    expect(ADMIN_UI_OPTIONS_TH).toEqual(swap)
    expect(ADMIN_UI_OPTIONS_TH.storageState.cookies[0].value).toBe("th")
  })

  test("พบไฟล์ e2e admin (รวมไฟล์ที่ไม่ได้ชื่อ admin แต่ loginAdmin)", () => {
    expect(adminSpecs.length).toBeGreaterThan(0)
    expect(adminSpecs).toContain("core-55-return-receive.spec.ts")
  })

  for (const file of adminSpecs) {
    test(`${file} ใส่ ...ADMIN_UI_OPTIONS หรือ ...ADMIN_UI_OPTIONS_TH ใน test.use`, () => {
      expect(read(file)).toMatch(/test\.use\(\{\s*\.\.\.ADMIN_UI_OPTIONS(_TH)?\b/)
    })
  }
})

test.describe("adminText (spec 10 กฎ 13)", () => {
  test("ค่าจาก th.json ของ dashboard และ json ของเรา; en ไม่มีอักษรไทย", () => {
    expect(adminText("en", "translation", "general.unsavedChangesTitle")).toBe("Are you sure you want to leave this form?")
    expect(adminText("th", "translation", "general.unsavedChangesTitle")).toMatch(THAI)
    expect(adminText("en", "ecom-common", "confirmDiscard.leave")).toBe("Leave")
    expect(adminText("th", "ecom-common", "confirmDiscard.leave")).toMatch(THAI)
  })

  test("key ไม่มี → throw (ไม่คืน key ดิบ)", () => {
    expect(() => adminText("th", "ecom-common", "nope.key")).toThrow(/nope\.key/)
  })
})

test.describe("adminLabel (spec 10 กฎ 13)", () => {
  test("หา key จากค่า en ของ namespace แล้วคืนค่าของภาษานั้น; ยังไม่แปล (ไม่มีค่า en นั้น) → ข้อความอังกฤษเดิม", () => {
    expect(adminLabel("en", "ecom-common", "Leave")).toBe("Leave")
    expect(adminLabel("th", "ecom-common", "Leave")).toBe(adminText("th", "ecom-common", "confirmDiscard.leave"))
    expect(adminLabel("th", "ecom-common", "Not a translated label")).toBe("Not a translated label")
  })
})

test.describe("pickLabel (spec 10 กฎ 13 — nit review AI18N-1)", () => {
  const en = { "a.create": "Create", "b.create": "Create", "c.save": "Save", "d.save": "Save" }

  test("ค่า en ซ้ำหลาย key แต่ค่าเป้าหมายเท่ากัน → คืนค่านั้น; ไม่มีค่า en → ข้อความเดิม", () => {
    const th = { "a.create": "สร้าง", "b.create": "สร้าง", "c.save": "บันทึก", "d.save": "เก็บ" }
    expect(pickLabel(en, th, "Create")).toBe("สร้าง")
    expect(pickLabel(en, th, "Missing")).toBe("Missing")
  })

  test("ค่า en ซ้ำหลาย key และค่าเป้าหมายต่างกัน → throw (ไม่เดา key แรก)", () => {
    const th = { "a.create": "สร้าง", "b.create": "สร้าง", "c.save": "บันทึก", "d.save": "เก็บ" }
    expect(() => pickLabel(en, th, "Save")).toThrow(/c\.save.*d\.save|กำกวม/)
  })
})
