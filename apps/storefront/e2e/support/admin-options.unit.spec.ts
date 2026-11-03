import { expect, test } from "@playwright/test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

import { ADMIN_UI_OPTIONS } from "./admin"

// spec 08 กฎ 12 / AC-3 (ADM-2b): e2e admin ทุกไฟล์รันด้วย locale en-US + timezone ไทย
// (useDate/getLocaleAmount ของ Medusa ใช้ timezone/locale ของ browser) — ตั้งที่ ADMIN_UI_OPTIONS ที่เดียว
const E2E_DIR = join(__dirname, "..")
const adminSpecs = readdirSync(E2E_DIR).filter((f) => /admin.*\.spec\.ts$/.test(f) && !f.endsWith(".unit.spec.ts"))

test.describe("ADMIN_UI_OPTIONS (spec 08 กฎ 12)", () => {
  test("ตั้ง locale en-US และ timezoneId Asia/Bangkok", () => {
    expect(ADMIN_UI_OPTIONS).toMatchObject({ locale: "en-US", timezoneId: "Asia/Bangkok" })
  })

  test("พบไฟล์ e2e admin", () => {
    expect(adminSpecs.length).toBeGreaterThan(0)
  })

  for (const file of adminSpecs) {
    test(`${file} ใส่ ...ADMIN_UI_OPTIONS ใน test.use`, () => {
      const src = readFileSync(join(E2E_DIR, file), "utf8")
      expect(src).toMatch(/test\.use\(\{\s*\.\.\.ADMIN_UI_OPTIONS\b/)
    })
  }
})
