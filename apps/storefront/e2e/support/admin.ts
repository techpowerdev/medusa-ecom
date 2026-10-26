import { Page } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"

// OPS-11 (spec 07 AC-16): login admin UI + header proxy ของ e2e admin อยู่ที่นี่ที่เดียว

export const ADMIN_LOGIN_URL = `${BACKEND_URL}/app/login`

/**
 * ใส่ใน test.use ของ e2e ที่เปิด admin UI: backend ที่ `medusa start` (production) ตั้ง session cookie
 * ของ admin เป็น Secure และเชื่อ proxy (trust proxy 1) — CI/local เป็น http จึงจำลอง proxy ที่ terminate TLS
 * แบบ prod ไม่เช่นนั้น Set-Cookie ไม่ถูกส่งและ login admin UI ไม่ติด
 */
export const ADMIN_UI_OPTIONS = { extraHTTPHeaders: { "x-forwarded-proto": "https" } }

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
