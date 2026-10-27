import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"
import { Client } from "pg"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-6 (spec 05 AC-26): แท็บ Payouts ของหน้า Affiliate ใน admin — เฉพาะแถว `draft` มีปุ่ม `affiliate-payout-cancel`
// ยืนยันด้วย usePrompt, dblclick → DELETE 1 ครั้งและแถวหายโดยไม่ reload; ยกเลิกกล่องยืนยัน → ไม่มี request
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({
  ...ADMIN_UI_OPTIONS,
  evidenceTarget: { feature: "affiliate", taskId: "AF-6" },
})

const DAY = 24 * 60 * 60 * 1000

/**
 * entry `approved` ของ affiliate ใส่ตรงใน DB (CI ตั้ง DATABASE_URL ให้ job e2e): การได้ entry approved ผ่าน flow จริง
 * ต้องรอ maturity job รายวัน (AF-4) ซึ่ง e2e สั่งรันไม่ได้ — payout สร้าง/จ่าย/ยกเลิกผ่าน admin API และ UI จริง
 */
async function insertApprovedEntry(affiliateId: string, programId: string, createdAt: Date) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(
      `insert into affiliate_commission_entry
         (id, affiliate_id, program_id, order_id, amount, raw_amount, currency, status, created_at, updated_at)
       values ($1, $2, $3, $4, 100, '{"value":"100","precision":20}', 'thb', 'approved', $5, $5)`,
      [
        `affcom_e2eaf6${crypto.randomBytes(6).toString("hex")}`,
        affiliateId,
        programId,
        "order_e2e_af6",
        createdAt,
      ],
    )
  } finally {
    await db.end()
  }
}

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, {
    headers: admin,
    data,
  })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-26: เฉพาะ payout draft มีปุ่มยกเลิก, ยกเลิกกล่องยืนยันไม่ยิง request, dblclick แล้วยืนยันยิง DELETE ครั้งเดียว", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-af6-ann")
  const { program } = await post(request, admin, "/admin/affiliate/programs", {
    name: "E2E AF-6",
    starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
    ends_at: new Date(Date.now() + DAY).toISOString(),
    commission_value: 10,
    scope: { all: true },
    status: "published",
  })
  const period = (from: number, to: number) => ({
    affiliate_id: ann.id,
    period_from: new Date(Date.now() - from * DAY).toISOString(),
    period_to: new Date(Date.now() - to * DAY).toISOString(),
  })

  await insertApprovedEntry(ann.id, program.id, new Date(Date.now() - 5 * DAY))
  const { payout: paid } = await post(request, admin, "/admin/affiliate/payouts", period(10, 3))
  await post(request, admin, `/admin/affiliate/payouts/${paid.id}/mark-paid`, {
    reference: "E2E-AF6",
  })
  await insertApprovedEntry(ann.id, program.id, new Date(Date.now() - DAY))
  const { payout: draft } = await post(request, admin, "/admin/affiliate/payouts", period(3, 0))
  expect(draft.status).toBe("draft")

  const cancelPath = `/admin/affiliate/payouts/${draft.id}`
  const deletes: string[] = []
  page.on("request", (req) => {
    if (req.method() === "DELETE" && new URL(req.url()).pathname === cancelPath) deletes.push(req.url())
  })
  const row = (id: string) => page.getByRole("row").filter({ hasText: id })

  await step("ล็อกอิน admin แล้วเปิดแท็บ Payouts → ปุ่มยกเลิกเฉพาะแถว draft", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await expect(row(draft.id)).toBeVisible({ timeout: 30_000 })
    await expect(row(paid.id)).toBeVisible()
    await expect(row(draft.id).getByTestId("affiliate-payout-cancel")).toHaveCount(1)
    await expect(row(paid.id).getByTestId("affiliate-payout-cancel")).toHaveCount(0)
    await evidence("01-payouts-tab")
  })

  await step("กดยกเลิกแล้วปิดกล่องยืนยัน → ไม่มี request และแถวยังอยู่", async () => {
    await row(draft.id).getByTestId("affiliate-payout-cancel").click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(300) // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence
    await evidence("02-confirm-prompt")
    await dialog.getByRole("button", { name: "Keep payout" }).click()
    await expect(dialog).toBeHidden()
    await page.waitForTimeout(500)
    expect(deletes).toHaveLength(0)
    await expect(row(draft.id)).toBeVisible()
  })

  await step("dblclick แล้วยืนยัน → DELETE 1 ครั้ง และแถวหายไปโดยไม่ reload", async () => {
    await page.evaluate(() => ((window as unknown as { __af6: boolean }).__af6 = true))
    await row(draft.id).getByTestId("affiliate-payout-cancel").dblclick()
    const dialog = page.getByRole("alertdialog")
    await dialog.getByRole("button", { name: "Cancel payout" }).click()
    await expect(row(draft.id)).toHaveCount(0)
    await expect(row(paid.id)).toBeVisible()
    expect(deletes).toHaveLength(1)
    expect(await page.evaluate(() => (window as unknown as { __af6?: boolean }).__af6)).toBe(true)
    await evidence("03-draft-cancelled")
    const res = await request.get(`${BACKEND_URL}${cancelPath}`, {
      headers: admin,
    })
    expect(res.status()).toBe(404)
  })
})
