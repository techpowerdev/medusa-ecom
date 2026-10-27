import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-12b (spec 05 กฎ 37b, AC-43): แท็บ Affiliates ของหน้า Affiliate ใน admin — approve (dblclick = POST 1 ครั้ง),
// suspend ยืนยันด้วย usePrompt (ยกเลิก = ไม่มี request), reactivate และฟอร์มข้อมูลรับเงิน 3 ช่อง (Save / Clear → null)
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "affiliate", taskId: "AF-12b" },
})

/** สมัคร affiliate (actor `affiliate`) ค้างสถานะ `pending` (spec 05 กฎ 7) */
async function createPendingAffiliate(request: APIRequestContext) {
  const code = `e2e-af12b-${Date.now().toString(36)}${crypto.randomInt(1e6)}`
  const reg = await request.post(`${BACKEND_URL}/auth/affiliate/emailpass/register`, {
    data: { email: `${code}@example.com`, password: crypto.randomBytes(12).toString("hex") },
  })
  expect(reg.status(), "affiliate auth register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/affiliate/register`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}` },
    data: { name: `E2E AF-12b`, code },
  })
  expect(created.status(), "affiliate register").toBe(200)
  const { affiliate } = await created.json()
  expect(affiliate.status).toBe("pending")
  return affiliate as { id: string; code: string }
}

async function getAffiliate(request: APIRequestContext, admin: Headers, id: string) {
  const res = await request.get(`${BACKEND_URL}/admin/affiliate/affiliates/${id}`, { headers: admin })
  expect(res.status()).toBe(200)
  return (await res.json()).affiliate as { status: string; payout_info: unknown }
}

test("AC-43: approve dblclick ยิงครั้งเดียว, suspend ผ่าน prompt, reactivate และบันทึก/ล้างข้อมูลรับเงิน", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const ann = await createPendingAffiliate(request)
  const path = `/admin/affiliate/affiliates/${ann.id}`
  const posts: Record<string, unknown>[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) posts.push(req.postDataJSON())
  })
  const row = page.getByRole("row").filter({ hasText: ann.code })
  const status = row.getByTestId("affiliate-status")

  await step("ล็อกอิน admin แล้วเปิดแท็บ Affiliates → แถว pending มีปุ่ม approve", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-affiliates").click()
    await expect(status).toHaveText("pending", { timeout: 30_000 })
    await expect(row.getByTestId("affiliate-approve")).toBeVisible()
    await expect(row.getByTestId("affiliate-suspend")).toHaveCount(0)
    await evidence("01-affiliates-pending")
  })

  await step("dblclick approve → POST 1 ครั้งด้วย status active และ badge เป็น active โดยไม่ reload", async () => {
    await page.evaluate(() => ((window as unknown as { __af12b: boolean }).__af12b = true))
    await row.getByTestId("affiliate-approve").dblclick()
    await expect(status).toHaveText("active")
    await page.waitForTimeout(500)
    expect(posts).toEqual([{ status: "active" }])
    expect(await page.evaluate(() => (window as unknown as { __af12b?: boolean }).__af12b)).toBe(true)
  })

  await step("suspend แล้วยกเลิก prompt → ไม่มี request; ยืนยัน → suspended และมีปุ่ม reactivate", async () => {
    await row.getByTestId("affiliate-suspend").click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(300) // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence
    await evidence("02-suspend-prompt")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await page.waitForTimeout(500)
    expect(posts).toHaveLength(1)
    await expect(status).toHaveText("active")

    await row.getByTestId("affiliate-suspend").dblclick()
    await page.getByRole("alertdialog").getByRole("button", { name: "Suspend" }).click()
    await expect(status).toHaveText("suspended")
    await expect(row.getByTestId("affiliate-reactivate")).toBeVisible()
    expect(posts.slice(1)).toEqual([{ status: "suspended" }])
    expect((await getAffiliate(request, admin, ann.id)).status).toBe("suspended")
  })

  await step("reactivate → active", async () => {
    await row.getByTestId("affiliate-reactivate").click()
    await expect(status).toHaveText("active")
    expect(posts.slice(2)).toEqual([{ status: "active" }])
  })

  const info = { bank_name: "Kasikorn Bank", account_name: "Ann E2E", account_number: "123-4-56789-0" }

  await step("ช่องว่าง → ไม่ส่ง; กรอก 3 ช่องแล้ว dblclick Save → POST 1 ครั้ง และ payout_info ตรงกัน", async () => {
    await row.getByTestId("affiliate-payout-info-edit").click()
    const drawer = page.getByTestId("affiliate-payout-info-drawer")
    await expect(drawer).toBeVisible()
    await drawer.getByTestId("affiliate-payout-info-bank_name").fill("  ")
    await drawer.getByTestId("affiliate-payout-info-save").click()
    await page.waitForTimeout(300)
    expect(posts).toHaveLength(3)
    await expect(drawer.getByTestId("affiliate-payout-info-error")).toHaveCount(3)

    await drawer.getByTestId("affiliate-payout-info-bank_name").fill(` ${info.bank_name} `)
    await drawer.getByTestId("affiliate-payout-info-account_name").fill(info.account_name)
    await drawer.getByTestId("affiliate-payout-info-account_number").fill(info.account_number)
    await expect(drawer.getByTestId("affiliate-payout-info-error")).toHaveCount(0)
    await evidence("03-payout-info-form")
    await drawer.getByTestId("affiliate-payout-info-save").dblclick()
    await expect(drawer).toBeHidden()
    expect(posts.slice(3)).toEqual([{ payout_info: info }])
    expect((await getAffiliate(request, admin, ann.id)).payout_info).toEqual(info)
  })

  await step("เปิดฟอร์มอีกครั้งเห็นค่าเดิม แล้ว Clear → payout_info = null", async () => {
    await row.getByTestId("affiliate-payout-info-edit").click()
    const drawer = page.getByTestId("affiliate-payout-info-drawer")
    await expect(drawer.getByTestId("affiliate-payout-info-account_number")).toHaveValue(info.account_number)
    await drawer.getByTestId("affiliate-payout-info-clear").click()
    await expect(drawer).toBeHidden()
    expect(posts.slice(4)).toEqual([{ payout_info: null }])
    expect((await getAffiliate(request, admin, ann.id)).payout_info).toBeNull()
    await evidence("04-payout-info-cleared")
  })
})
