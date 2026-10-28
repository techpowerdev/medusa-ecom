import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// AF-14 (spec 05 กฎ 38, AC-45): คอลัมน์ Affiliate ของ Ledger/Payouts แสดงชื่อ + อีเมล ดึงทีละหน้าด้วย id[] 1 request
// affiliate ที่หาไม่เจอแสดง affiliate_id เดิม — admin UI เป็นภาษาอังกฤษ หา element ด้วย data-testid
test.use({
  ...ADMIN_UI_OPTIONS,
  evidenceTarget: { feature: "affiliate", taskId: "AF-14" },
})

const DAY = 24 * 60 * 60 * 1000
const AFFILIATES = "/admin/affiliate/affiliates"

/** นับ GET /admin/affiliate/affiliates ที่มี filter id (รูป qs ของ JS SDK: id[0]=… หรือ id[]=…) */
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

test("AC-45: Ledger/Payouts แสดงชื่อและอีเมลของ affiliate ด้วย request id[] 1 ครั้งต่อหน้า", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-af14-ann")
  const bob = await createActiveAffiliate(request, admin, "e2e-af14-bob")
  const programRes = await request.post(`${BACKEND_URL}/admin/affiliate/programs`, {
    headers: admin,
    data: {
      name: "E2E AF-14",
      starts_at: new Date(Date.now() - 30 * DAY).toISOString(),
      ends_at: new Date(Date.now() + DAY).toISOString(),
      commission_value: 10,
      scope: { all: true },
      status: "published",
    },
  })
  expect(programRes.status(), await programRes.text()).toBe(200)
  const { program } = await programRes.json()
  // order id ไม่ซ้ำต่อ run (รันซ้ำบน DB เดิมได้)
  const run = Date.now().toString(36)
  const order = (who: string) => `order_e2e_af14_${who}_${run}`

  // payout ของ Bob (entry ของ Bob ถูกจ่ายเข้า payout) แล้ว entry ของ Ann และ entry ของ affiliate ที่ไม่มีอยู่ (ใหม่สุด)
  await insertApprovedEntry(bob.id, program.id, order("bob"), new Date(Date.now() - DAY))
  const payoutRes = await request.post(`${BACKEND_URL}/admin/affiliate/payouts`, {
    headers: admin,
    data: {
      affiliate_id: bob.id,
      period_from: new Date(Date.now() - 2 * DAY).toISOString(),
      period_to: new Date(Date.now()).toISOString(),
    },
  })
  expect(payoutRes.status(), await payoutRes.text()).toBe(200)
  const { payout } = await payoutRes.json()
  await insertApprovedEntry(ann.id, program.id, order("ann"), new Date())
  const missingId = `aff_e2e_af14_missing_${run}`
  await insertApprovedEntry(missingId, program.id, order("missing"), new Date(Date.now() + 1000))

  const nameRequests = countNameRequests(page)
  const row = (text: string) => page.getByRole("row").filter({ hasText: text })

  await step("แท็บ Ledger → แถวของ Ann แสดงชื่อ + อีเมล, affiliate ที่หาไม่เจอแสดง id; ยิง id[] 1 ครั้ง", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-ledger").click()
    const annCell = row(order("ann")).getByTestId("affiliate-row-affiliate")
    await expect(annCell).toContainText(ann.email, { timeout: 30_000 })
    await expect(annCell).toContainText("E2E e2e-af14-ann")
    await expect(annCell).not.toContainText(ann.id)
    await expect(row(order("missing")).getByTestId("affiliate-row-affiliate")).toHaveText(missingId)
    await page.waitForTimeout(500)
    expect(nameRequests, "GET affiliates?id[] ต่อหน้า Ledger").toHaveLength(1)
    expect(nameRequests[0]).toContain(ann.id)
    expect(nameRequests[0]).toContain(missingId)
    await evidence("01-ledger-names")
  })

  await step("แท็บ Payouts → แถว payout ของ Bob แสดงชื่อ + อีเมล; ยิง id[] 1 ครั้ง", async () => {
    nameRequests.length = 0
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    const bobCell = row(payout.id).getByTestId("affiliate-row-affiliate")
    await expect(bobCell).toContainText(bob.email, { timeout: 30_000 })
    await expect(bobCell).toContainText("E2E e2e-af14-bob")
    await expect(bobCell).not.toContainText(bob.id)
    await page.waitForTimeout(500)
    expect(nameRequests, "GET affiliates?id[] ต่อหน้า Payouts").toHaveLength(1)
    expect(nameRequests[0]).toContain(bob.id)
    await evidence("02-payouts-names")
  })
})
