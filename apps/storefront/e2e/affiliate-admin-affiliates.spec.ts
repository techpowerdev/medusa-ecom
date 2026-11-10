import { APIRequestContext, Locator } from "@playwright/test"
import crypto from "node:crypto"

import { ADMIN_UI_OPTIONS, closeRowMenu, loginAdmin, rowAction } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-12b (spec 05 กฎ 37b, AC-43): แท็บ Affiliates ของหน้า Affiliate ใน admin — approve (POST 1 ครั้ง; กดซ้ำระหว่างรอ → affiliate-admin-row-actions),
// suspend ยืนยันด้วย usePrompt (ยกเลิก = ไม่มี request), reactivate และฟอร์มข้อมูลรับเงิน 3 ช่อง (Save / Clear → null)
// AF-15 (กฎ 39, AC-46): ปุ่มสถานะส่ง expected_status (แท็บอื่นเปลี่ยนแล้ว → 409 → toast + refetch), เลขบัญชี 10–12 หลัก,
// Clear ยืนยันด้วย usePrompt และรอด้วย expect.poll/สถานะของ element (ไม่หน่วงเวลาตายตัว)
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid ยกเว้น menuitem ของ ActionMenu ต่อแถว
// (trigger `affiliate-row-actions`, หาด้วย role + ชื่อ — spec 08 กฎ 10, ADM-8b)
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

test("AC-43: approve ยิงครั้งเดียว, suspend ผ่าน prompt, reactivate และบันทึก/ล้างข้อมูลรับเงิน", async ({
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
  // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence (ไม่หน่วงเวลาตายตัว)
  const settled = (locator: Locator) =>
    locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  const row = page.getByRole("row").filter({ hasText: ann.code })
  const status = row.getByTestId("affiliate-status")
  const action = (name: string) => rowAction(row, "affiliate-row-actions", name)

  await step("ล็อกอิน admin แล้วเปิดแท็บ Affiliates → แถว pending มีปุ่ม approve", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-affiliates").click()
    await expect(status).toHaveText("pending", { timeout: 30_000 })
    await expect(await action("Approve")).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Suspend" })).toHaveCount(0)
    await evidence("01-affiliates-pending")
    await closeRowMenu(page)
  })

  await step("กด menuitem Approve → POST 1 ครั้งด้วย status active และ badge เป็น active โดยไม่ reload", async () => {
    await page.evaluate(() => ((window as unknown as { __af12b: boolean }).__af12b = true))
    await (await action("Approve")).click()
    await expect(status).toHaveText("active")
    await expect.poll(() => posts).toEqual([{ status: "active", expected_status: "pending" }])
    expect(await page.evaluate(() => (window as unknown as { __af12b?: boolean }).__af12b)).toBe(true)
  })

  await step("suspend แล้วยกเลิก prompt → ไม่มี request; ยืนยัน → suspended และมีปุ่ม reactivate", async () => {
    await (await action("Suspend")).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await settled(dialog)
    await evidence("02-suspend-prompt")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await expect(status).toHaveText("active")

    await (await action("Suspend")).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Suspend" }).click()
    await expect(status).toHaveText("suspended")
    await expect(await action("Reactivate")).toBeVisible()
    await closeRowMenu(page)
    // ไม่มี request จากการยกเลิก prompt: request ถัดจาก approve คือ suspend ที่ยืนยันแล้วเท่านั้น
    await expect.poll(() => posts.slice(1)).toEqual([{ status: "suspended", expected_status: "active" }])
    expect((await getAffiliate(request, admin, ann.id)).status).toBe("suspended")
  })

  await step("reactivate → active", async () => {
    await (await action("Reactivate")).click()
    await expect(status).toHaveText("active")
    await expect.poll(() => posts.slice(2)).toEqual([{ status: "active", expected_status: "suspended" }])
  })

  const info = { bank_name: "Kasikorn Bank", account_name: "Ann E2E", account_number: "123-4-56789-0" }
  // กฎ 39a: เก็บเลขบัญชีที่ตัด - และช่องว่างแล้ว
  const stored = { ...info, account_number: "1234567890" }

  await step("ช่องว่าง/เลขบัญชี 9 หลัก → ไม่ส่ง; กรอก 3 ช่องแล้ว dblclick Save → POST 1 ครั้ง และ payout_info ตรงกัน", async () => {
    await (await action("Payout info")).click()
    const drawer = page.getByTestId("affiliate-payout-info-drawer")
    await expect(drawer).toBeVisible()
    await drawer.getByTestId("affiliate-payout-info-bank_name").fill("  ")
    await drawer.getByTestId("affiliate-payout-info-save").click()
    await expect(drawer.getByTestId("affiliate-payout-info-error")).toHaveCount(3)

    await drawer.getByTestId("affiliate-payout-info-bank_name").fill(info.bank_name)
    await drawer.getByTestId("affiliate-payout-info-account_name").fill(info.account_name)
    await drawer.getByTestId("affiliate-payout-info-account_number").fill("123-456-789")
    await drawer.getByTestId("affiliate-payout-info-save").click()
    await expect(drawer.getByTestId("affiliate-payout-info-error")).toHaveCount(1)

    await drawer.getByTestId("affiliate-payout-info-bank_name").fill(` ${info.bank_name} `)
    await drawer.getByTestId("affiliate-payout-info-account_name").fill(info.account_name)
    await drawer.getByTestId("affiliate-payout-info-account_number").fill(info.account_number)
    await expect(drawer.getByTestId("affiliate-payout-info-error")).toHaveCount(0)
    await evidence("03-payout-info-form")
    await drawer.getByTestId("affiliate-payout-info-save").dblclick()
    await expect(drawer).toBeHidden()
    // request ถัดจาก reactivate คือ Save ครั้งเดียว — กด Save ที่ไม่ผ่าน validator ก่อนหน้าไม่ได้ยิง
    await expect.poll(() => posts.slice(3)).toEqual([{ payout_info: stored }])
    expect((await getAffiliate(request, admin, ann.id)).payout_info).toEqual(stored)
  })

  await step("เปิดฟอร์มอีกครั้งเห็นค่าเดิม; Clear แล้วยกเลิก prompt → ไม่มี request; ยืนยัน → payout_info = null", async () => {
    await (await action("Payout info")).click()
    const drawer = page.getByTestId("affiliate-payout-info-drawer")
    await expect(drawer.getByTestId("affiliate-payout-info-account_number")).toHaveValue(stored.account_number)
    await drawer.getByTestId("affiliate-payout-info-clear").click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await expect(drawer).toBeVisible()

    await drawer.getByTestId("affiliate-payout-info-clear").click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Clear" }).click()
    await expect(drawer).toBeHidden()
    // request ถัดจาก Save คือ Clear ที่ยืนยันแล้วเท่านั้น — การยกเลิก prompt ไม่ได้ยิง
    await expect.poll(() => posts.slice(4)).toEqual([{ payout_info: null }])
    expect((await getAffiliate(request, admin, ann.id)).payout_info).toBeNull()
    await evidence("04-payout-info-cleared")
  })
})

// evidence ของ AC-46 อยู่ใต้ AF-15 (ไม่ปนกับงบ 5 รูปของ AF-12b)
test.describe("AF-15", () => {
  test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-15" } })

  test("AC-46: แท็บอื่นระงับ affiliate แล้วหน้าเดิมกด approve → 409 → toast และแถวแสดง suspended หลัง refetch", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const bob = await createPendingAffiliate(request)
    const path = `/admin/affiliate/affiliates/${bob.id}`
    const responses: number[] = []
    page.on("response", (res) => {
      if (res.request().method() === "POST" && new URL(res.url()).pathname === path) responses.push(res.status())
    })
    const row = page.getByRole("row").filter({ hasText: bob.code })
    const status = row.getByTestId("affiliate-status")
    const action = (name: string) => rowAction(row, "affiliate-row-actions", name)

    await step("เปิดแท็บ Affiliates → แถวแสดง pending", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-admin-tab-affiliates").click()
      await expect(status).toHaveText("pending", { timeout: 30_000 })
    })

    await step("อีกแท็บระงับ (API) แล้วหน้าเดิมกด approve → 409 + toast error และแถวเป็น suspended", async () => {
      const suspend = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data: { status: "suspended" } })
      expect(suspend.status()).toBe(200)
      await expect(status).toHaveText("pending")

      await (await action("Approve")).click()
      await expect.poll(() => responses).toEqual([409])
      // toast ข้อความจาก API (admin เป็นอังกฤษ; toast ไม่มี testid — แบบ evoucher-admin-resend)
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Affiliate status changed" })).toBeVisible()
      await expect(status).toHaveText("suspended")
      await expect(await action("Reactivate")).toBeVisible()
      await closeRowMenu(page)
      expect((await getAffiliate(request, admin, bob.id)).status).toBe("suspended")
      await evidence("01-stale-approve-conflict")
    })
  })
})
