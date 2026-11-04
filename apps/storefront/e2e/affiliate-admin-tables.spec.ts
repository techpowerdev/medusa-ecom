import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry, insertDraftPayouts } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-8a (spec 08 AC-11, กฎ 6, 9): ตาราง affiliate ใช้ DataTable ของ dashboard — หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset` ต่อแท็บ)
// เงินแสดงด้วย getLocaleAmount ตาม locale ของ browser (en-US → ฿) — admin UI เป็นภาษาอังกฤษ
// ปุ่ม Next ของ DataTable เป็น component ของ Medusa ที่ใส่ testid ไม่ได้ จึงหาด้วย role + ชื่อ (แบบ evoucher-admin-pool-page)
test.use({
  ...ADMIN_UI_OPTIONS,
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-8a" },
})

const DAY = 24 * 60 * 60 * 1000
const AFFILIATES = "/admin/affiliate/affiliates"

/** นับ GET /admin/affiliate/affiliates ที่มี filter id (ชื่อ/อีเมลของแถวในหน้า — AF-14) */
function countNameRequests(page: Page) {
  const urls: string[] = []
  page.on("request", (req) => {
    const url = new URL(req.url())
    const hasIdFilter = Array.from(url.searchParams.keys()).some((k) => k.startsWith("id"))
    if (req.method() === "GET" && url.pathname === AFFILIATES && hasIdFilter) {
      urls.push(url.search)
    }
  })
  return urls
}

test("AC-11: Ledger แสดง ฿1,234.50, แบ่งหน้าใน URL ต่อแท็บ และดึงชื่อ 1 request ต่อหน้า", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-adm8a")
  const programRes = await request.post(`${BACKEND_URL}/admin/affiliate/programs`, {
    headers: admin,
    data: {
      name: "E2E ADM-8a",
      starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
      ends_at: new Date(Date.now() + DAY).toISOString(),
      commission_value: 10,
      scope: { all: true },
      status: "published",
    },
  })
  expect(programRes.status(), await programRes.text()).toBe(200)
  const { program } = await programRes.json()

  // 21 entry ให้ Ledger มีอย่างน้อย 2 หน้า (หน้า 20 แถว) และ payout 21 แถวให้ Payouts มีอย่างน้อย 2 หน้า
  // แถวถมหน้าลงวันที่ย้อนไป 1 ปี จึงเก่ากว่าแถวของ test อื่นเสมอ (ไม่ดันแถวที่ test อื่นเพิ่งสร้างตกไปหน้า 2 เมื่อรันพร้อมกัน
  // หรือรันซ้ำบน DB เดิม) — มีเพียง entry ยอด 1234.5 ที่เป็นแถวใหม่สุด (ดันแถวอื่นแค่ 1 แถวเหมือน test อื่น)
  // entry ถมหน้าเป็นของ affiliate อีกคน: หน้า 2 จึงมีชุด affiliate_id ต่างจากหน้า 1 (ann อยู่หน้า 1 เท่านั้น) และยิง id[] ใหม่เสมอ
  // แม้ DB ว่าง (รันไฟล์นี้ก่อนไฟล์อื่น) — ถ้าทุกแถวเป็นของ ann ชุด id ของสองหน้าเท่ากัน หน้า 2 ใช้ cache และไม่ยิง request
  const filler = await createActiveAffiliate(request, admin, "e2e-adm8a-fill")
  const run = Date.now().toString(36)
  const past = Date.now() - 365 * DAY
  for (let i = 1; i <= 20; i++) {
    await insertApprovedEntry(filler.id, program.id, `order_e2e_adm8a_${run}_${i}`, new Date(past - i * 1000))
  }
  const bigOrder = `order_e2e_adm8a_${run}_big`
  await insertApprovedEntry(ann.id, program.id, bigOrder, new Date(), "1234.5")
  await insertDraftPayouts(ann.id, 21, new Date(past))

  const nameRequests = countNameRequests(page)
  const row = (text: string) => page.getByRole("row").filter({ hasText: text })

  await step("Ledger: entry ยอด 1234.5 THB แสดง ฿1,234.50 (locale en-US)", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-ledger").click()
    await expect(row(bigOrder)).toContainText("฿1,234.50", { timeout: 30_000 })
    await expect(row(bigOrder).getByTestId("affiliate-row-affiliate")).toContainText(ann.email)
    await page.waitForTimeout(500)
    expect(nameRequests, "GET affiliates?id[] หน้า 1 ของ Ledger").toHaveLength(1)
    await evidence("01-ledger-amount")
  })

  await step("Ledger: กด Next → URL มี ledger_offset=20 และยิง id[] เพิ่ม 1 ครั้ง (AC-45 ของ spec 05)", async () => {
    nameRequests.length = 0
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page).toHaveURL(/[?&]ledger_offset=20(&|$)/)
    await expect(row(bigOrder)).toHaveCount(0)
    await expect(page.getByTestId("affiliate-row-affiliate").first()).toBeVisible()
    await page.waitForTimeout(500)
    expect(nameRequests, "GET affiliates?id[] หน้า 2 ของ Ledger").toHaveLength(1)
  })

  await step("Payouts: กด Next → URL มี payouts_offset=20 เท่านั้น (ไม่มี offset ของ Programs)", async () => {
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    // ไม่ assert ตำแหน่งของแถวที่ใส่ไว้ (test อื่นอาจสร้าง payout ใหม่กว่าใน DB เดียวกัน) — จำ id ของแถวแรกในหน้า 1 แทน
    const payoutRows = page.getByRole("row").filter({ hasText: /affpay_/ })
    await expect(payoutRows.first()).toBeVisible({ timeout: 30_000 })
    const firstId = (await payoutRows.first().innerText()).match(/affpay_\w+/)?.[0]
    expect(firstId, "id ของ payout แถวแรกในหน้า 1").toBeTruthy()
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page).toHaveURL(/[?&]payouts_offset=20(&|$)/)
    await expect(row(firstId!)).toHaveCount(0)
    await expect(payoutRows.first()).toBeVisible()
    const params = new URL(page.url()).searchParams
    expect(Array.from(params.keys()).filter((k) => k.endsWith("_offset"))).toEqual(["payouts_offset"])
    await evidence("02-payouts-page-2")
  })

  await step("offset ใน URL ผิดรูป (abc / ติดลบ) → แก้ URL เป็นหน้าแรก (replace) และตารางแสดงหน้าแรก", async () => {
    await page.goto(`${BACKEND_URL}/app/affiliate?programs_offset=abc`)
    await expect(page.getByRole("row").filter({ hasText: "E2E ADM-8a" }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page).not.toHaveURL(/programs_offset=/)
    await page.goto(`${BACKEND_URL}/app/affiliate?programs_offset=-20`)
    await expect(page.getByRole("row").filter({ hasText: "E2E ADM-8a" }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page).not.toHaveURL(/programs_offset=/)
    await expect(page.getByText(/NaN/)).toHaveCount(0)
  })
})
