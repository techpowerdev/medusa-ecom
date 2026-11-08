import { APIRequestContext, Page } from "@playwright/test"
import crypto from "node:crypto"

import { ADMIN_UI_OPTIONS, closeRowMenu, loginAdmin, rowAction } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// ADM-8b (spec 08 AC-13, กฎ 4, 10): ปุ่มต่อแถวของแท็บ Affiliates/Payouts อยู่ใน ActionMenu ของ dashboard
// (trigger `affiliate-row-actions`, `affiliate-payout-row-actions`; menuitem หาด้วย role + ชื่อ) — กด menuitem ซ้ำระหว่างรอ
// response = request เดียว และ action ของแถว payout เดียวกันกันกัน (Cancel กำลังส่ง → Mark paid disabled)
// response ถูกกักด้วย page.route จนกว่า test ปล่อย (ไม่หน่วงเวลาตายตัว)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-8b" },
})

const DAY = 24 * 60 * 60 * 1000
const PAYOUTS = "/admin/affiliate/payouts"

/** กัก request ที่ตรง `url` (เฉพาะ `method`) จน `release()` — คืนตัวปล่อย */
async function hold(page: Page, url: string, method: string) {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(url, async (route) => {
    if (route.request().method() === method) await held
    await route.continue()
  })
  return () => release()
}

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** สมัคร affiliate ค้าง `pending` (spec 05 กฎ 7) */
async function createPendingAffiliate(request: APIRequestContext) {
  const code = `e2e-adm8b-${Date.now().toString(36)}${crypto.randomInt(1e6)}`
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email: `${code}@example.com`, password: crypto.randomBytes(12).toString("hex") },
  })
  expect(reg.status(), "affiliate auth register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/affiliate/register`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}` },
    data: { name: "E2E ADM-8b", code },
  })
  expect(created.status(), "affiliate register").toBe(200)
  const { affiliate } = await created.json()
  expect(affiliate.status).toBe("pending")
  return affiliate as { id: string; code: string }
}

test("AC-13: menuitem Approve กดซ้ำระหว่างรอ response → POST 1 ครั้ง และ badge เป็น active โดยไม่ reload", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pending = await createPendingAffiliate(request)
  const path = `/admin/affiliate/affiliates/${pending.id}`
  const posts: unknown[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) posts.push(req.postDataJSON())
  })
  const row = page.getByRole("row").filter({ hasText: pending.code })
  const status = row.getByTestId("affiliate-status")

  await step("เปิดแท็บ Affiliates → เมนูของแถว pending มี Approve และ Payout info", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-affiliates").click()
    await expect(status).toHaveText("pending", { timeout: 30_000 })
    await expect(await rowAction(row, "affiliate-row-actions", "Approve")).toBeEnabled()
    await expect(page.getByRole("menuitem", { name: "Payout info" })).toBeVisible()
    await evidence("01-affiliate-row-menu")
    await closeRowMenu(page)
  })

  await step("กด Approve แล้วเปิดเมนูกด Approve ซ้ำก่อนได้ response → menuitem disabled และมี POST 1 ครั้ง", async () => {
    const release = await hold(page, `**${path}`, "POST")
    await (await rowAction(row, "affiliate-row-actions", "Approve")).click()
    await expect.poll(() => posts.length).toBe(1)

    const again = await rowAction(row, "affiliate-row-actions", "Approve")
    await expect(again).toBeDisabled()
    await again.click({ force: true })
    await closeRowMenu(page)

    const response = page.waitForResponse((res) => new URL(res.url()).pathname === path)
    release()
    expect((await response).status()).toBe(200)
    await expect(status).toHaveText("active")
    expect(posts).toEqual([{ status: "active", expected_status: "pending" }])
    await expect(await rowAction(row, "affiliate-row-actions", "Suspend")).toBeVisible()
    await closeRowMenu(page)
  })
})

test("AC-13: Cancel ของ payout กำลังส่ง → เปิดเมนูแถวเดียวกัน menuitem Mark paid disabled จนการยกเลิกจบ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-adm8b-ann")
  const { program } = await post(request, admin, "/admin/affiliate/programs", {
    name: "E2E ADM-8b",
    starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
    ends_at: new Date(Date.now() + DAY).toISOString(),
    commission_value: 10,
    scope: { all: true },
    status: "published",
  })
  await insertApprovedEntry(ann.id, program.id, "order_e2e_adm8b", new Date(Date.now() - DAY))
  const { payout: draft } = await post(request, admin, PAYOUTS, {
    affiliate_id: ann.id,
    period_from: new Date(Date.now() - 3 * DAY).toISOString(),
    period_to: new Date(Date.now()).toISOString(),
  })
  expect(draft.status).toBe("draft")

  const requests: string[] = []
  page.on("request", (req) => {
    const p = new URL(req.url()).pathname
    if (p.startsWith(`${PAYOUTS}/${draft.id}`) && req.method() !== "GET") requests.push(`${req.method()} ${p}`)
  })
  const row = page.getByRole("row").filter({ hasText: draft.id })
  const trigger = "affiliate-payout-row-actions"

  await step("เปิดแท็บ Payouts → เมนูของแถว draft มี Mark paid และ Cancel", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await expect(await rowAction(row, trigger, "Mark paid")).toBeEnabled()
    await expect(page.getByRole("menuitem", { name: "Cancel", exact: true })).toBeEnabled()
    await evidence("02-payout-row-menu")
    await closeRowMenu(page)
  })

  await step("Cancel → ยืนยัน (DELETE ถูกกัก) → เปิดเมนูอีกครั้ง Mark paid/Cancel disabled และกดแล้วไม่มี request", async () => {
    const release = await hold(page, `**${PAYOUTS}/${draft.id}`, "DELETE")
    await (await rowAction(row, trigger, "Cancel")).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel payout" }).click()
    await expect(page.getByRole("alertdialog")).toBeHidden()
    await expect.poll(() => requests).toEqual([`DELETE ${PAYOUTS}/${draft.id}`])

    const markPaid = await rowAction(row, trigger, "Mark paid")
    await expect(markPaid).toBeDisabled()
    await expect(page.getByRole("menuitem", { name: "Cancel", exact: true })).toBeDisabled()
    await evidence("03-mark-paid-disabled-while-cancelling")
    await markPaid.click({ force: true })
    await closeRowMenu(page)
    // กดแล้วไม่เปิดกล่อง mark paid และไม่มี request อื่น
    await expect(page.getByTestId("affiliate-payout-mark-paid-confirm")).toHaveCount(0)

    const response = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && new URL(res.url()).pathname === `${PAYOUTS}/${draft.id}`,
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(row).toHaveCount(0)
    expect(requests).toEqual([`DELETE ${PAYOUTS}/${draft.id}`])
  })
})
