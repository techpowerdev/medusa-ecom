import { APIRequestContext, Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin, rowAction } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// ADM-47 (spec 08 กฎ 51, AC-52): ฟอร์มที่เปิดจากเมนู `…` ของตาราง partners/payouts/affiliates ปิดแล้ว focus ไปที่ปุ่ม `…`
// ของแถวเดิม (ตัวที่ remount ใหม่ตอนเปิด) ไม่หลุดไป BODY — แบบ programs ของ ADM-44 (admin-program-form-edit.spec.ts)
// menuitem ของ ActionMenu หาด้วย role + ชื่อ (ข้อยกเว้นของ testid — ADR-018); ปุ่มใน Drawer ของ partner ไม่มี testid ของ Cancel
// จึงหาด้วย role + ชื่อภายใน dialog (แบบ e2e ของ ADM-44)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-47" },
})

const DAY = 24 * 60 * 60 * 1000
const PAYOUTS = "/admin/affiliate/payouts"
const uniqueTag = () => `adm47${Date.now()}${Math.random().toString(36).slice(2, 8)}`

const dialog = (page: Page) => page.getByRole("dialog")
const alert = (page: Page) => page.getByRole("alertdialog")

/** "opener" เมื่อ trigger คือ document.activeElement ไม่งั้นชื่อ tag ของ activeElement (บน develop = "BODY") */
const focusedOn = (trigger: Locator) =>
  trigger.evaluate((el) => (el === document.activeElement ? "opener" : (document.activeElement?.tagName ?? "null")))

/** Radix คืน focus ใน setTimeout หลังปิด → poll */
const expectFocusOnTrigger = (trigger: Locator) => expect.poll(() => focusedOn(trigger)).toBe("opener")

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-52: partners — Edit จากเมนู … ปิดด้วย Cancel / Escape / Save สำเร็จ → focus ที่ปุ่ม … ของแถว", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `ADM-47 partner ${uniqueTag()}`
  const { partner } = await post(request, admin, "/admin/evoucher/partners", { name })
  const row = page.getByTestId("evoucher-partners-table").getByRole("row").filter({ hasText: name })
  const trigger = row.getByTestId("evoucher-partner-row-actions")
  const open = async () => {
    await (await rowAction(row, "evoucher-partner-row-actions", "Edit")).click()
    await expect(dialog(page)).toBeVisible()
  }

  try {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await expect(row).toBeVisible({ timeout: 30_000 })

    await step("Cancel → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expectFocusOnTrigger(trigger)
    })

    await step("Escape → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await page.keyboard.press("Escape")
      await expect(dialog(page)).toHaveCount(0)
      await expectFocusOnTrigger(trigger)
    })

    await step("Save สำเร็จ → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await dialog(page).getByLabel("Support contact", { exact: true }).fill("adm47@example.com")
      await page.getByTestId("evoucher-partner-save").click()
      await expect(dialog(page)).toHaveCount(0)
      await expectFocusOnTrigger(trigger)
      await evidence("01-partner-trigger-focused-after-save")
    })
  } finally {
    const removed = await request.delete(`${BACKEND_URL}/admin/evoucher/partners/${partner.id}`, { headers: admin })
    expect.soft(removed.ok(), `ลบ partner ${partner.id}`).toBe(true)
  }
})

test("AC-52: affiliates — Payout info จากเมนู … ปิดด้วย Escape (Drawer ไม่มีปุ่ม Cancel) / Save สำเร็จ → focus ที่ปุ่ม … ของแถว", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-adm47" })
  const row = page.getByTestId("affiliate-affiliates-table").getByRole("row").filter({ hasText: affiliate.code })
  const trigger = row.getByTestId("affiliate-row-actions")
  const drawer = page.getByTestId("affiliate-payout-info-drawer")
  const open = async () => {
    await (await rowAction(row, "affiliate-row-actions", "Payout info")).click()
    await expect(drawer).toBeVisible()
  }

  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/affiliate`)
  await page.getByTestId("affiliate-admin-tab-affiliates").click()
  await expect(row).toBeVisible({ timeout: 30_000 })

  await step("Escape → focus ที่ปุ่ม … ของแถว", async () => {
    await open()
    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
    await expectFocusOnTrigger(trigger)
  })

  await step("Save สำเร็จ → focus ที่ปุ่ม … ของแถว", async () => {
    await open()
    await page.getByTestId("affiliate-payout-info-bank_name").fill("ADM-47 Bank")
    await page.getByTestId("affiliate-payout-info-account_name").fill("ADM-47")
    await page.getByTestId("affiliate-payout-info-account_number").fill("1234567890")
    await page.getByTestId("affiliate-payout-info-save").click()
    await expect(drawer).toHaveCount(0)
    await expectFocusOnTrigger(trigger)
    await evidence("02-affiliate-trigger-focused-after-save")
  })
})

test("AC-52: payouts — Mark paid จากเมนู … ปิดด้วย Keep as draft / Escape → focus ที่ปุ่ม … ของแถว; ยืนยันสำเร็จ → แถว paid ไม่มีปุ่ม … (กฎ 10)", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-adm47-pay" })
  const { program } = await post(request, admin, "/admin/affiliate/programs", {
    name: `ADM-47 ${uniqueTag()}`,
    starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
    ends_at: new Date(Date.now() + DAY).toISOString(),
    commission_value: 10,
    scope: { all: true },
    status: "published",
  })
  await insertApprovedEntry(affiliate.id, program.id, `order_e2e_${uniqueTag()}`, new Date(Date.now() - DAY))
  const { payout } = await post(request, admin, PAYOUTS, {
    affiliate_id: affiliate.id,
    period_from: new Date(Date.now() - 3 * DAY).toISOString(),
    period_to: new Date(Date.now()).toISOString(),
  })
  expect(payout.status).toBe("draft")
  const row = page.getByTestId("affiliate-payouts-table").getByRole("row").filter({ hasText: payout.id })
  const trigger = row.getByTestId("affiliate-payout-row-actions")
  const open = async () => {
    await (await rowAction(row, "affiliate-payout-row-actions", "Mark paid")).click()
    await expect(alert(page)).toBeVisible()
  }

  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/affiliate`)
  await page.getByTestId("affiliate-admin-tab-payouts").click()
  await expect(row).toBeVisible({ timeout: 30_000 })

  await step("Keep as draft (Cancel) → focus ที่ปุ่ม … ของแถว", async () => {
    await open()
    await page.getByTestId("affiliate-payout-mark-paid-dismiss").click()
    await expect(alert(page)).toHaveCount(0)
    await expectFocusOnTrigger(trigger)
    await evidence("03-payout-trigger-focused-after-cancel")
  })

  await step("Escape → focus ที่ปุ่ม … ของแถว", async () => {
    await open()
    await page.keyboard.press("Escape")
    await expect(alert(page)).toHaveCount(0)
    await expectFocusOnTrigger(trigger)
  })

  await step("Mark as paid สำเร็จ → แถวเป็น paid และไม่มีปุ่ม … ให้คืน focus (spec 08 กฎ 10)", async () => {
    await open()
    await page.getByTestId("affiliate-payout-mark-paid-confirm").click()
    await expect(alert(page)).toHaveCount(0)
    await expect(trigger).toHaveCount(0)
  })
})
