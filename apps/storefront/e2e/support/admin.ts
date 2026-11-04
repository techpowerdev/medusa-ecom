import { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"

// OPS-11 (spec 07 AC-16): login admin UI + header proxy ของ e2e admin อยู่ที่นี่ที่เดียว

export const ADMIN_LOGIN_URL = `${BACKEND_URL}/app/login`

/**
 * ใส่ใน test.use ของ e2e ที่เปิด admin UI: backend ที่ `medusa start` (production) ตั้ง session cookie
 * ของ admin เป็น Secure และเชื่อ proxy (trust proxy 1) — CI/local เป็น http จึงจำลอง proxy ที่ terminate TLS
 * แบบ prod ไม่เช่นนั้น Set-Cookie ไม่ถูกส่งและ login admin UI ไม่ติด
 * spec 08 กฎ 12 (ADM-2b): วันเวลา/เงินใน admin ตาม timezone/locale ของ browser (useDate, getLocaleAmount ของ Medusa)
 * จึงตั้ง locale en-US + timezone ไทยให้ผลตายตัว (ภาษาของ admin ยังเป็น English — useDate อ่าน locale จากภาษานั้น)
 */
export const ADMIN_UI_OPTIONS = {
  extraHTTPHeaders: { "x-forwarded-proto": "https" },
  locale: "en-US",
  timezoneId: "Asia/Bangkok",
}

const env = (key: string, fallback: string) => {
  const value = process.env[key] ?? process.env[fallback]
  if (!value) throw new Error(`ต้องตั้ง env ${key} หรือ ${fallback} สำหรับ e2e`)
  return value
}

/** ล็อกอิน admin UI ด้วย credential จาก env (ค่าเดียวกับที่ seed สร้าง admin) */
export async function loginAdmin(page: Page) {
  await page.goto(ADMIN_LOGIN_URL)
  await page.locator('input[name="email"]').fill(env("E2E_ADMIN_EMAIL", "SEED_ADMIN_EMAIL"))
  await page.locator('input[name="password"]').fill(env("E2E_ADMIN_PASSWORD", "SEED_ADMIN_PASSWORD"))
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith("/app/login"))
  await expect(page.locator('input[name="email"]')).toHaveCount(0)
}

/**
 * ADM-7 (spec 08): กรอก `DatePicker` (`granularity="minute"`) ของ `@medusajs/ui` ด้วยคีย์บอร์ด — `wrapper` คือ element ที่ห่อ
 * DatePicker (เช่น `getByTestId("gb-field-starts_at")`) และ `value` เป็นเวลาตามเครื่อง (`timezoneId` ของ test) รูป `YYYY-MM-DDTHH:mm`
 * คลิก segment แรกแล้วพิมพ์ตามลำดับ segment ของ en-US: เดือน/วัน/ปี ชั่วโมง (12 ชม.):นาที AM/PM — segment เต็มแล้วเลื่อนไปช่องถัดไปเอง
 */
export async function fillDatePicker(wrapper: Locator, value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error(`fillDatePicker: ต้องเป็น YYYY-MM-DDTHH:mm ได้ ${value}`)
  const [, year, month, day, hour, minute] = match
  const hour24 = Number(hour)
  const hour12 = String(hour24 % 12 || 12).padStart(2, "0")
  const segments = wrapper.getByRole("spinbutton")
  await segments.first().click()
  await wrapper.page().keyboard.type(`${month}${day}${year}${hour12}${minute}${hour24 < 12 ? "A" : "P"}`)
  // segment สุดท้าย (AM/PM) แสดงค่าแล้ว = DatePicker ได้ค่าครบทุกช่อง
  await expect(segments.last()).toHaveText(hour24 < 12 ? "AM" : "PM")
}
