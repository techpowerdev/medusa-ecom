import { APIRequestContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"
import type { Headers } from "./medusa"

// OPS-11 (spec 07 AC-16): login admin UI + header proxy ของ e2e admin อยู่ที่นี่ที่เดียว

export const ADMIN_LOGIN_URL = `${BACKEND_URL}/app/login`

/** spec 08 กฎ 29a: ข้อความของแถบแบ่งหน้าของ `DataTable` ("1 — 2 of 2 results", "2 of 1 pages") — ตอน error ต้องไม่มี ("0 of 0 results") */
export const PAGINATION_TEXT = /\d+ of \d+ (results|pages)/

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

/** ADM-9: ค่าที่ `DatePicker` แสดงตรงกับ `YYYY-MM-DDTHH:mm` (เวลาเครื่อง) — segment en-US: เดือน/วัน/ปี ชั่วโมง 12 ชม.:นาที AM/PM */
export async function expectDatePicker(wrapper: Locator, value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error(`expectDatePicker: ต้องเป็น YYYY-MM-DDTHH:mm ได้ ${value}`)
  const [, year, month, day, hour, minute] = match
  const hour24 = Number(hour)
  const number = (n: number) => new RegExp(`^0?${n}$`)
  await expect(wrapper.getByRole("spinbutton")).toHaveText([
    number(Number(month)),
    number(Number(day)),
    year,
    number(hour24 % 12 || 12),
    minute,
    hour24 < 12 ? "AM" : "PM",
  ])
}

/**
 * ADM-8b (spec 08 กฎ 10): ปุ่มต่อแถวอยู่ใน `ActionMenu` ของ dashboard — คลิก trigger (testid ภายในแถว) แล้วคืน menuitem ตามชื่อ
 * (label อังกฤษ; ข้อยกเว้นของการหาด้วย testid — CLAUDE.md) ผู้เรียก click/ตรวจ disabled เอง แล้วกด Escape ถ้าไม่เลือก
 */
export async function rowAction(row: Locator, trigger: string, name: string) {
  await row.getByTestId(trigger).click()
  return row.page().getByRole("menuitem", { name, exact: true })
}

/**
 * ADM-35 (spec 08 กฎ 39d): รอ animation/transition ของ element และลูกทั้งหมดเล่นจบ (ไม่ใช่การรอเวลา) — ถ้าไม่มี animation อยู่ resolve ทันที
 * animation/transition ที่ถูกยกเลิก (เช่น transition ของ focus ring เมื่อ Radix คืน focus ซ้ำ) reject ด้วย AbortError = ไม่ได้เล่นอยู่แล้ว จึงนับว่าจบ
 */
export async function animationsSettled(locator: Locator) {
  await locator.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)))
  )
}

/**
 * ADM-33 (spec 08 กฎ 37c): รอ `ActionMenu` ที่เปิดอยู่ (1 ตัว) เล่น animation เปิดจบ — Escape ที่กดทันทีที่เมนูโผล่ (< 1 frame)
 * Radix ยังไม่รับ เมนูจึงค้าง (วัดบน prod build: กดทันที 7/12 ค้าง, รอ animation จบ 0/12) ซึ่งคนกดไม่ทันขนาดนั้น — ไม่ใช่ timeout ตายตัว
 * เมนูที่ไม่มี animation (เช่นเปิด prefers-reduced-motion หรือเล่นจบแล้ว) resolve ทันทีหลังพบเมนู 1 ตัว (ADM-35 กฎ 39d)
 */
export async function waitMenuOpened(page: Page) {
  const menu = page.getByRole("menu")
  await expect(menu).toHaveCount(1)
  await animationsSettled(menu)
}

/**
 * ADM-35 (spec 08 กฎ 39d — ตามคำตัดสิน session หลัก 2026-11-18): offset ของหน้าใน `DataTable` ที่มีแถว `id` — ไล่หน้าผ่าน admin API
 * ด้วยขนาดหน้าและลำดับเดียวกับตาราง (`query` = query ที่หน้า admin ส่ง เช่น `order=name`) แล้วเปิดหน้านั้นด้วย `<prefix>_offset` ใน URL
 * แทนการพึ่งว่าแถวเรียงอยู่หน้าแรก (ตารางเหล่านี้ปิดช่องค้นหา `q`)
 */
export async function pageOffsetOf(
  request: APIRequestContext,
  admin: Headers,
  { path, key, id, pageSize = 20, query = "" }: { path: string; key: string; id: string; pageSize?: number; query?: string }
) {
  for (let offset = 0; ; offset += pageSize) {
    const res = await request.get(`${BACKEND_URL}${path}?limit=${pageSize}&offset=${offset}&fields=id${query ? `&${query}` : ""}`, {
      headers: admin,
    })
    expect(res.ok(), `GET ${path}: ${await res.text()}`).toBe(true)
    const body = await res.json()
    const rows: { id: string }[] = body[key]
    if (rows.some((row) => row.id === id)) return offset
    if (offset + pageSize >= body.count) throw new Error(`pageOffsetOf: ไม่พบ ${id} ใน ${path} (count ${body.count})`)
  }
}

/**
 * ปิด `ActionMenu` ที่เปิดอยู่โดยไม่เลือก — Escape ครั้งเดียว (spec 08 กฎ 37c: เดิมวนกดซ้ำเพราะ tooltip ของ `TruncatedCell` ใน
 * `DataTable` กิน Escape แรก; ADM-33 ปิด tooltip ในคอลัมน์ actions แล้ว — ถ้าล้มที่นี่ ให้ตรวจ meta `___truncateTooltip` ของคอลัมน์นั้น)
 * ระหว่างเมนูเปิด Radix ซ่อนส่วนอื่นจาก accessibility tree (`getByRole("row")` หาไม่เจอ) ต้องปิดก่อนหาแถวถัดไป
 */
export async function closeRowMenu(page: Page) {
  await waitMenuOpened(page)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
}
