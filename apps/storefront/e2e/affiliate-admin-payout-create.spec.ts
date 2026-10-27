import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-12c (spec 05 กฎ 37c, AC-44): แท็บ Payouts — สร้าง payout ผ่านฟอร์ม (ช่วงเริ่มต้น = เดือนก่อนตามเวลาไทย) และ mark paid พร้อม reference
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "affiliate", taskId: "AF-12c" },
})

const DAY = 24 * 60 * 60 * 1000
const ICT = 7 * 60 * 60 * 1000
const PAYOUTS = "/admin/affiliate/payouts"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(request: APIRequestContext, admin: Headers, path: string, data?: object): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers: admin })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-44: ฟอร์มสร้าง payout ค่าเริ่มต้นเดือนก่อน, dblclick ยิง POST ครั้งเดียว, ไม่มี entry → toast, mark paid พร้อม/ไม่พร้อม reference", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-af12c-ann")
  const sue = await createActiveAffiliate(request, admin, "e2e-af12c-sue")
  await call(request, admin, `/admin/affiliate/affiliates/${sue.id}`, { status: "suspended" })
  // affiliate `pending` (ยังไม่อนุมัติ) — ตั้งกลับเป็น pending ผ่าน admin API เดียวกับที่ใช้อนุมัติ
  const pat = await createActiveAffiliate(request, admin, "e2e-af12c-pat")
  await call(request, admin, `/admin/affiliate/affiliates/${pat.id}`, { status: "pending" })

  const { program } = await call(request, admin, "/admin/affiliate/programs", {
    name: `E2E AF-12c ${Date.now()}`,
    starts_at: new Date(Date.now() - 90 * DAY).toISOString(),
    ends_at: new Date(Date.now() - 60 * DAY).toISOString(),
    commission_value: 10,
    scope: { all: true },
    status: "published",
  })
  // "เดือนก่อน" ตามเวลาไทย: วันที่ 15 ของเดือนก่อน 12:00 ICT
  const ict = new Date(Date.now() + ICT)
  const [y, m] = [ict.getUTCFullYear(), ict.getUTCMonth()]
  const ymd = (month: number) => new Date(Date.UTC(y, month, 1)).toISOString().slice(0, 10)
  await insertApprovedEntry(ann.id, program.id, "order_e2e_af12c", new Date(Date.UTC(y, m - 1, 15, 5)))
  await insertApprovedEntry(ann.id, program.id, "order_e2e_af12c", new Date(Date.UTC(y, m - 1, 16, 5)))

  const posts: { path: string; body: Json }[] = []
  page.on("request", (req) => {
    const path = new URL(req.url()).pathname
    if (req.method() === "POST" && path.startsWith(PAYOUTS)) posts.push({ path, body: req.postDataJSON() })
  })
  const row = (id: string) => page.getByRole("row").filter({ hasText: id })
  const save = page.getByTestId("affiliate-payout-save")
  const pickAffiliate = async (email: string) => {
    await page.getByTestId("affiliate-payout-field-affiliate_id").click()
    await page.getByRole("option").filter({ hasText: email }).click()
  }

  let payoutId = ""
  await step("เปิดฟอร์ม → ค่าเริ่มต้นเดือนก่อนตามเวลาไทย และตัวเลือกมี active + suspended ไม่มี pending", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await page.getByTestId("affiliate-payout-create").click()
    await expect(page.getByTestId("affiliate-payout-field-period_from")).toHaveValue(ymd(m - 1))
    await expect(page.getByTestId("affiliate-payout-field-period_to")).toHaveValue(ymd(m))
    await page.getByTestId("affiliate-payout-field-affiliate_id").click()
    const options = page.getByRole("option")
    await expect(options.filter({ hasText: ann.email })).toHaveCount(1)
    await expect(options.filter({ hasText: sue.email })).toHaveCount(1)
    await expect(options.filter({ hasText: pat.email })).toHaveCount(0)
    await evidence("01-payout-form")
    await page.keyboard.press("Escape")
  })

  await step("affiliate ที่ไม่มี entry → toast error และไม่มีแถวใหม่", async () => {
    await pickAffiliate(sue.email)
    await save.click()
    await expect(page.getByText("Nothing to pay")).toBeVisible()
    expect(posts).toHaveLength(1)
    const { payouts } = await call(request, admin, `${PAYOUTS}?affiliate_id=${sue.id}`)
    expect(payouts).toHaveLength(0)
  })

  await step("เลือก Ann แล้ว dblclick Create → POST 1 ครั้งและแถว draft ใหม่แสดงยอดรวม", async () => {
    posts.length = 0
    await pickAffiliate(ann.email)
    const created = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PAYOUTS)
    await save.dblclick()
    payoutId = (await (await created).json()).payout.id
    await expect(save).toBeHidden()
    await expect(row(payoutId)).toBeVisible()
    await expect(row(payoutId)).toContainText("draft")
    await expect(row(payoutId)).toContainText("THB 200.00")
    expect(posts.filter((p) => p.path === PAYOUTS)).toHaveLength(1)
    await evidence("02-draft-created")
  })

  await step("ยกเลิก prompt mark paid → ไม่มี request", async () => {
    posts.length = 0
    await row(payoutId).getByTestId("affiliate-payout-mark-paid").click()
    await page.getByTestId("affiliate-payout-mark-paid-dismiss").click()
    await expect(page.getByRole("alertdialog")).toBeHidden()
    await page.waitForTimeout(300)
    expect(posts).toEqual([])
  })

  await step("mark paid พร้อม reference TRX-AC44 → paid, ไม่มีปุ่ม, entry ทั้งหมดเป็น paid", async () => {
    await row(payoutId).getByTestId("affiliate-payout-mark-paid").dblclick()
    await page.getByTestId("affiliate-payout-mark-paid-reference").fill("TRX-AC44")
    await page.waitForTimeout(300) // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence
    await evidence("03-mark-paid-prompt")
    await page.getByTestId("affiliate-payout-mark-paid-confirm").dblclick()
    await expect(row(payoutId)).toContainText("TRX-AC44")
    await expect(row(payoutId)).toContainText("paid")
    await expect(row(payoutId).getByTestId("affiliate-payout-mark-paid")).toHaveCount(0)
    await expect(row(payoutId).getByTestId("affiliate-payout-cancel")).toHaveCount(0)
    expect(posts).toEqual([{ path: `${PAYOUTS}/${payoutId}/mark-paid`, body: { reference: "TRX-AC44" } }])
    await evidence("04-paid")
    const { payout } = await call(request, admin, `${PAYOUTS}/${payoutId}`)
    const { entries } = await call(request, admin, `/admin/affiliate/entries?status=paid&affiliate_id=${ann.id}&limit=200`)
    expect(payout.entry_ids).toHaveLength(2)
    expect(entries.map((e: Json) => e.id).sort()).toEqual([...payout.entry_ids].sort())
  })

  await step("mark paid โดย reference มีแต่ช่องว่าง → body ไม่มี key reference และได้ 200", async () => {
    await insertApprovedEntry(ann.id, program.id, "order_e2e_af12c", new Date(Date.now() - DAY))
    const { payout: draft } = await call(request, admin, PAYOUTS, {
      affiliate_id: ann.id,
      period_from: new Date(Date.now() - 2 * DAY).toISOString(),
      period_to: new Date(Date.now() + DAY).toISOString(),
    })
    posts.length = 0
    await page.reload()
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await row(draft.id).getByTestId("affiliate-payout-mark-paid").click()
    await page.getByTestId("affiliate-payout-mark-paid-reference").fill("   ")
    const paid = page.waitForResponse((r) => new URL(r.url()).pathname === `${PAYOUTS}/${draft.id}/mark-paid`)
    await page.getByTestId("affiliate-payout-mark-paid-confirm").click()
    expect((await paid).status()).toBe(200)
    expect(posts).toEqual([{ path: `${PAYOUTS}/${draft.id}/mark-paid`, body: {} }])
    await expect(row(draft.id).getByTestId("affiliate-payout-mark-paid")).toHaveCount(0)
  })
})
