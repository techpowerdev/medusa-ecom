import { APIRequestContext, Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin, waitMenuOpened } from "./support/admin"
import { createActiveAffiliate, insertDraftPayouts } from "./support/affiliate"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { call, createVoucher } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// ADM-33 (spec 08 AC-38b, กฎ 37): เมนู `ActionMenu` ในคอลัมน์ actions ของ `DataTable` ปิดด้วย Escape ครั้งเดียวทุกครั้ง
// ต้นเหตุ: `TruncatedCell` ของ @medusajs/ui ห่อ cell ด้วย `Tooltip` — เมื่อ focus กลับมาที่ trigger (หลังปิดเมนูครั้งแรก หรือ focus
// ด้วยคีย์บอร์ด) tooltip เปิดและกิน Escape แรก → เมนูค้างและ body `pointer-events: none` จนกด Escape อีกครั้ง
// (วัดบน develop: คลิกแถวเดิมซ้ำค้างที่ 4/5 ตาราง ส่วน partners ค้างเมื่อสลับไปเปิดแถวอื่น — test จึงเปิดแถวเดิมซ้ำและแถวที่สองด้วย)
// ขั้นที่ตรวจกด Escape ครั้งเดียวต่อการเปิดเมนู ไม่วน `toPass` (กฎ 37c) — ถ้า bump @medusajs/ui แล้ว `___truncateTooltip` ใช้ไม่ได้ test นี้ล้ม (กฎ 37d)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-33" },
})

const DAY = 24 * 60 * 60 * 1000
const tag = () => `adm33-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`
const bodyPointerEvents = (page: Page) => page.evaluate(() => document.body.style.pointerEvents)
type Step = (title: string, body: () => Promise<void>) => Promise<void>

/** เมนูเปิดจบแล้ว (waitMenuOpened — ไม่ใช่การรอเวลา) → Escape ครั้งเดียว → เมนูหายภายใน 2s และ body ไม่ค้าง pointer-events: none */
async function expectMenuClosedByOneEscape(page: Page) {
  await waitMenuOpened(page)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0, { timeout: 2_000 })
  await expect.poll(() => bodyPointerEvents(page), { timeout: 2_000 }).not.toBe("none")
}

/**
 * คลิก trigger แถวแรก → Escape → คลิก trigger เดิมอีกครั้ง → Escape → คลิก trigger แถวที่สอง → Escape (ทุกครั้งกดครั้งเดียว)
 * แล้วทางคีย์บอร์ด: focus trigger แถวแรก + Enter → Escape ครั้งเดียว
 */
async function expectRowMenuEscape(page: Page, rows: Locator, trigger: string, step: Step) {
  const first = rows.nth(0).getByTestId(trigger)
  const second = rows.nth(1).getByTestId(trigger)
  await expect(first).toBeVisible({ timeout: 30_000 })
  await expect(second).toBeVisible()

  await step("คลิก trigger → Escape ปิด → คลิก trigger เดิมอีกครั้ง → Escape ครั้งเดียวปิด → แถวที่สอง → Escape ครั้งเดียวปิด (body ไม่ค้าง pointer-events: none)", async () => {
    await first.click()
    await expectMenuClosedByOneEscape(page)
    await first.click()
    await expectMenuClosedByOneEscape(page)
    await second.click()
    await expectMenuClosedByOneEscape(page)
  })

  await step("คีย์บอร์ด: focus trigger + Enter → เมนูเปิด → Escape ครั้งเดียวปิด", async () => {
    await first.focus()
    await page.keyboard.press("Enter")
    await expectMenuClosedByOneEscape(page)
  })
}

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** แถวของตาราง (wrapper testid) ที่มีข้อความ run tag ของ test — 2 แถวที่ test สร้าง */
const taggedRows = (page: Page, table: string, run: string) => page.getByTestId(table).locator("tbody tr", { hasText: run })

test("AC-38: e-voucher partners — Escape ครั้งเดียวปิดเมนูต่อแถว", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const run = tag()
  const ids: string[] = []
  try {
    for (const n of [1, 2]) ids.push((await post(request, admin, "/admin/evoucher/partners", { name: `Partner ${run} ${n}` })).partner.id)
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await expectRowMenuEscape(page, taggedRows(page, "evoucher-partners-table", run), "evoucher-partner-row-actions", step)
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/evoucher/partners/${id}`))
  }
})

// pool ที่มี code ลบไม่ได้ (NOT_ALLOWED) → partner ของ voucher ก็ลบไม่ได้ — ไม่มีข้อมูลที่ลบได้ (เหมือน e2e ของหน้า pool เดิม)
test("AC-38: e-voucher codes — Escape ครั้งเดียวปิดเมนูต่อแถว", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const { variantId } = await createVoucher(request, admin, 2)
  const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/evouchers/pools/${pools[0].id}`)
  await expectRowMenuEscape(page, page.getByTestId("evoucher-codes").locator("tbody tr"), "evoucher-code-row-actions", step)
})

test("AC-38: affiliate programs — Escape ครั้งเดียวปิดเมนูต่อแถว", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const run = tag()
  const ids: string[] = []
  try {
    // draft: ลบได้ใน finally (โปรแกรม published/ended ลบไม่ได้)
    for (const n of [1, 2]) {
      const { program } = await post(request, admin, "/admin/affiliate/programs", {
        name: `E2E ${run} ${n}`,
        starts_at: new Date(Date.now() + 30 * DAY).toISOString(),
        ends_at: new Date(Date.now() + 60 * DAY).toISOString(),
        commission_value: 10,
        scope: { all: true },
        status: "draft",
      })
      ids.push(program.id)
    }
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await expectRowMenuEscape(page, taggedRows(page, "affiliate-programs-table", run), "affiliate-program-row-actions", step)
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/programs/${id}`))
  }
})

// affiliate ไม่มี API ลบ (spec 05) — ข้อมูลของ test นี้ลบไม่ได้ เหมือน e2e affiliate เดิม
test("AC-38: affiliate affiliates — Escape ครั้งเดียวปิดเมนูต่อแถว", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const run = tag()
  // หาแถวจากชื่อ (code ของ affiliate ยาวจำกัด — ใส่ run tag ไม่พอ)
  for (const n of [1, 2]) await createActiveAffiliate(request, admin, { prefix: `e2e-a33-${n}`, name: `E2E ${run} ${n}` })
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/affiliate`)
  await page.getByTestId("affiliate-admin-tab-affiliates").click()
  await expectRowMenuEscape(page, page.locator("tbody tr", { hasText: run }), "affiliate-row-actions", step)
})

test("AC-38: affiliate payouts — Escape ครั้งเดียวปิดเมนูต่อแถว", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-adm33-pay" })
  // payout draft 2 แถวใส่ตรงใน DB (insertDraftPayouts ของ ADM-8a) — DELETE ของ draft = ยกเลิก (ลบได้ทางเดียวของ payout)
  const ids = await insertDraftPayouts(affiliate.id, 2, new Date())
  try {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    const rows = page.getByTestId("affiliate-payouts-table").locator("tbody tr").filter({ hasText: new RegExp(ids.join("|")) })
    await expectRowMenuEscape(page, rows, "affiliate-payout-row-actions", step)
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/payouts/${id}`))
  }
})
