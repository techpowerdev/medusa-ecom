import { APIRequestContext, Locator, Page } from "@playwright/test"
import crypto from "node:crypto"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, adminText, closeRowMenu, loginAdmin, rowAction } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { THAI } from "./support/thai-text"

// spec 10 AC-11 (AI18N-4, กฎ 7, 9, 13): หน้า affiliate ของ admin แสดงตามภาษาที่เลือก (cookie/localStorage `lng` — กลไกของ Medusa)
// ค่าที่คาดสร้างจาก `json/<lng>/ecom-affiliate.json` ผ่าน `adminText` (ไม่ hard-code ประโยคไทย); lng=en ของ element เดียวกันต้องไม่มีอักษรไทย
// ลิงก์เมนูด้านข้าง/ปุ่มใน action ของ DataTable/menuitem ของ ActionMenu หาด้วย role + ชื่อภายใน container ที่แคบที่สุด (ข้อยกเว้น — ADR-018)

type Lng = "en" | "th"
const NS = "ecom-affiliate"
const TABS = [
  ["programs", "affiliate-programs-table"],
  ["affiliates", "affiliate-affiliates-table"],
  ["ledger", "affiliate-ledger-table"],
  ["payouts", "affiliate-payouts-table"],
] as const

/** สมัคร affiliate (actor `affiliate`) ค้างสถานะ `pending` (spec 05 กฎ 7) — แบบ affiliate-admin-affiliates.spec.ts */
async function createPendingAffiliate(request: APIRequestContext) {
  const code = `e2e-ai18n4-${Date.now().toString(36)}${crypto.randomInt(1e6)}`
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email: `${code}@example.com`, password: crypto.randomBytes(12).toString("hex") },
  })
  expect(reg.status(), "affiliate auth register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/affiliate/register`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}` },
    data: { name: "E2E AI18N-4", code },
  })
  expect(created.status(), "affiliate register").toBe(200)
  const { affiliate } = await created.json()
  expect(affiliate.status).toBe("pending")
  return affiliate as { id: string; code: string }
}

/** ข้อความของ element = ค่าของภาษานั้น; th มีอักษรไทย, en ไม่มี */
async function expectText(locator: Locator, lng: Lng, key: string) {
  const text = adminText(lng, NS, key)
  await expect(locator).toHaveText(text)
  if (lng === "th") expect(text).toMatch(THAI)
  else expect(await locator.textContent()).not.toMatch(THAI)
}

async function checkAffiliatePage(page: Page, request: APIRequestContext, lng: Lng, evidence?: (name: string) => Promise<void>) {
  const pending = await createPendingAffiliate(request)
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/affiliate`)

  // เมนูด้านข้าง (defineRouteConfig label + translationNs — กฎ 9)
  const nav = page.getByRole("complementary").getByRole("link", { name: adminText(lng, NS, "nav.label"), exact: true })
  await expect(nav).toBeVisible({ timeout: 30_000 })
  if (lng === "en") expect(await nav.textContent()).not.toMatch(THAI)

  // ชื่อแท็บ 4 แท็บ + heading ตารางของแต่ละแท็บ
  for (const [tab] of TABS) await expectText(page.getByTestId(`affiliate-admin-tab-${tab}`), lng, `tabs.${tab}`)
  for (const [tab, wrapper] of TABS) {
    await page.getByTestId(`affiliate-admin-tab-${tab}`).click()
    await expectText(page.getByTestId(wrapper).getByRole("heading", { level: 2 }), lng, `${tab}.heading`)
  }
  await evidence?.("01-affiliate-tabs-th")

  // ฟอร์มสร้างโปรแกรม: กด Save โดยไม่กรอกชื่อ → error ใต้ช่องชื่อ (testid เดิม)
  await page.getByTestId("affiliate-admin-tab-programs").click()
  await page
    .getByTestId("affiliate-programs-table")
    .getByRole("button", { name: adminText(lng, NS, "programs.create"), exact: true })
    .click()
  await page.getByTestId("affiliate-program-save").click()
  await expectText(page.getByTestId("affiliate-program-error-name"), lng, "programForm.errors.name")
  await evidence?.("02-program-form-error-th")

  // เมนูต่อแถวของ affiliate pending: menuitem Approve (+ badge สถานะ — กฎ 7) — ค้นด้วย code ผ่าน `affiliates_q` ใน URL
  await page.goto(`${BACKEND_URL}/app/affiliate?tab=affiliates&affiliates_q=${pending.code}`)
  const row = page.getByTestId("affiliate-affiliates-table").getByRole("row").filter({ hasText: pending.code })
  await expectText(row.getByTestId("affiliate-status"), lng, "affiliates.status.pending")
  const approve = await rowAction(row, "affiliate-row-actions", adminText(lng, NS, "affiliates.actions.approve"))
  await expect(approve).toBeVisible()
  if (lng === "th") expect(await approve.textContent()).toMatch(THAI)
  else expect(await approve.textContent()).not.toMatch(THAI)
  await evidence?.("03-row-menu-approve-th")
  await closeRowMenu(page)
}

test.describe("lng=th", () => {
  test.use({
    ...ADMIN_UI_OPTIONS_TH,
    viewport: { width: 1280, height: 800 },
    evidenceTarget: { feature: "admin-i18n", taskId: "AI18N-4" },
  })

  test("AC-11: เมนู/แท็บ/heading/error ฟอร์มโปรแกรม/menuitem Approve เป็นค่า th ของ ecom-affiliate", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await step("หน้า /affiliate โหมดไทย", () => checkAffiliatePage(page, request, "th", evidence))
  })
})

test.describe("lng=en", () => {
  test.use({ ...ADMIN_UI_OPTIONS, viewport: { width: 1280, height: 800 } })

  test("AC-11: element เดียวกันเป็นค่า en (ข้อความเดิม) ไม่มีอักษรไทย", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    await step("ค่า en เท่าข้อความเดิม", async () => {
      expect([
        adminText("en", NS, "nav.label"),
        adminText("en", NS, "programs.create"),
        adminText("en", NS, "programForm.errors.name"),
        adminText("en", NS, "affiliates.actions.approve"),
      ]).toEqual(["Affiliate", "Create program", "Name is required", "Approve"])
    })
    await step("หน้า /affiliate โหมดอังกฤษ", () => checkAffiliatePage(page, request, "en"))
  })
})
