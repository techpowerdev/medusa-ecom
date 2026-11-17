import { APIRequestContext } from "@playwright/test"
import { Client } from "pg"

import { ADMIN_UI_OPTIONS, expectDatePicker, loginAdmin, rowAction } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// AF-12c (spec 05 กฎ 37c, AC-44): แท็บ Payouts — สร้าง payout ผ่านฟอร์ม (ช่วงเริ่มต้น = เดือนก่อนตามเวลาไทย) และ mark paid พร้อม reference
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid ยกเว้น menuitem ของ ActionMenu ต่อแถว
// (trigger `affiliate-payout-row-actions`, หาด้วย role + ชื่อ — spec 08 กฎ 10, ADM-8b)
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

/** SQL ตรงกับ DB ของ backend (CI ตั้ง DATABASE_URL ให้ job e2e) — ไม่มี DELETE affiliate ใน admin API */
async function sql(text: string, values: unknown[]): Promise<Json[]> {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    return (await db.query(text, values)).rows
  } finally {
    await db.end()
  }
}

/** CORE-61 (spec 01 กฎข้อ 119c): cleanup ที่ล้มบันทึกเป็น expect.soft — ไม่ throw ทับ error ของ test */
async function softSql(label: string, text: string, values: unknown[]): Promise<Json[]> {
  const result = await sql(text, values).then(
    (rows) => ({ rows, error: null }),
    (error: Error) => ({ rows: [], error: error.message }),
  )
  expect.soft(result.error, label).toBeNull()
  return result.rows
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
  // CORE-61 (spec 01 กฎข้อ 119c): id ที่ test สร้าง — ลบใน finally ตามลำดับ payout → entry → affiliate → program
  const affiliateIds: string[] = []
  const programIds: string[] = []
  try {
    const ann = await createActiveAffiliate(request, admin, { prefix: "e2e-af12c-ann" })
    affiliateIds.push(ann.id)
    const sue = await createActiveAffiliate(request, admin, { prefix: "e2e-af12c-sue" })
    affiliateIds.push(sue.id)
    await call(request, admin, `/admin/affiliate/affiliates/${sue.id}`, { status: "suspended" })
    // affiliate `pending` (ยังไม่อนุมัติ) — ตั้งกลับเป็น pending ผ่าน admin API เดียวกับที่ใช้อนุมัติ
    const pat = await createActiveAffiliate(request, admin, { prefix: "e2e-af12c-pat" })
    affiliateIds.push(pat.id)
    await call(request, admin, `/admin/affiliate/affiliates/${pat.id}`, { status: "pending" })

    const { program } = await call(request, admin, "/admin/affiliate/programs", {
      name: `E2E AF-12c ${Date.now()}`,
      starts_at: new Date(Date.now() - 90 * DAY).toISOString(),
      ends_at: new Date(Date.now() - 60 * DAY).toISOString(),
      commission_value: 10,
      scope: { all: true },
      status: "published",
    })
    programIds.push(program.id)
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
    // ADM-24 (spec 08 กฎ 28b): ตัวเลือกเรียงตามชื่อ ไม่ใช่ใหม่สุดก่อน — ค้นด้วยอีเมล (q) เพื่อไม่ขึ้นกับจำนวน affiliate ใน DB
    const affiliateField = page.getByTestId("affiliate-payout-field-affiliate_id")
    const pickAffiliate = async (email: string) => {
      await affiliateField.click()
      await affiliateField.fill(email)
      await page.getByRole("option").filter({ hasText: email }).click()
    }

    let payoutId = ""
    await step("เปิดฟอร์ม → ค่าเริ่มต้นเดือนก่อนตามเวลาไทย และตัวเลือกมี active + suspended ไม่มี pending", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
      await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_from"), `${ymd(m - 1)}T00:00`)
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_to"), `${ymd(m)}T00:00`)
      await affiliateField.click()
      const options = page.getByRole("option")
      for (const [email, count] of [[ann.email, 1], [sue.email, 1], [pat.email, 0]] as const) {
        const searched = page.waitForResponse((r) => new URL(r.url()).searchParams.get("q") === email)
        await affiliateField.fill(email)
        // CORE-61 (กฎข้อ 119c): ตรวจ response ก่อน — count 0 ของ pat ผ่านได้ก่อนรายการ render ถ้าไม่ตรวจ
        const emails = (await (await searched).json()).affiliates.map((a: Json) => a.email)
        expect(emails, email).toEqual(count ? expect.arrayContaining([email]) : [])
        await expect(options.filter({ hasText: email })).toHaveCount(count)
      }
      await evidence("01-payout-form")
      // ADM-9: ตัวเลือกเป็น Combobox — Escape ปิดทั้ง FocusModal (เดิมปิดแค่ Select) step ถัดไปเลือกจาก popover ที่เปิดอยู่ได้เลย
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
      await expect(row(payoutId)).toContainText("฿200.00")
      expect(posts.filter((p) => p.path === PAYOUTS)).toHaveLength(1)
      await evidence("02-draft-created")
    })

    await step("ยกเลิก prompt mark paid → ไม่มี request", async () => {
      posts.length = 0
      await (await rowAction(row(payoutId), "affiliate-payout-row-actions", "Mark paid")).click()
      await page.getByTestId("affiliate-payout-mark-paid-dismiss").click()
      await expect(page.getByRole("alertdialog")).toBeHidden()
      await page.waitForTimeout(300)
      expect(posts).toEqual([])
    })

    await step("mark paid พร้อม reference TRX-AC44 → paid, ไม่มีปุ่ม, entry ทั้งหมดเป็น paid", async () => {
      await (await rowAction(row(payoutId), "affiliate-payout-row-actions", "Mark paid")).click()
      await page.getByTestId("affiliate-payout-mark-paid-reference").fill("TRX-AC44")
      await page.waitForTimeout(300) // ให้ animation ของกล่องยืนยันจบก่อนถ่าย evidence
      await evidence("03-mark-paid-prompt")
      await page.getByTestId("affiliate-payout-mark-paid-confirm").dblclick()
      await expect(row(payoutId)).toContainText("TRX-AC44")
      await expect(row(payoutId)).toContainText("paid")
      await expect(row(payoutId).getByTestId("affiliate-payout-row-actions")).toHaveCount(0)
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
      await (await rowAction(row(draft.id), "affiliate-payout-row-actions", "Mark paid")).click()
      await page.getByTestId("affiliate-payout-mark-paid-reference").fill("   ")
      const paid = page.waitForResponse((r) => new URL(r.url()).pathname === `${PAYOUTS}/${draft.id}/mark-paid`)
      await page.getByTestId("affiliate-payout-mark-paid-confirm").click()
      expect((await paid).status()).toBe(200)
      expect(posts).toEqual([{ path: `${PAYOUTS}/${draft.id}/mark-paid`, body: {} }])
      await expect(row(draft.id).getByTestId("affiliate-payout-row-actions")).toHaveCount(0)
    })
  } finally {
    await softSql("ลบ payout ของ test", "delete from affiliate_payout where affiliate_id = any($1)", [affiliateIds])
    await softSql("ลบ commission entry ของ order_e2e_af12c", "delete from affiliate_commission_entry where order_id = $1 and affiliate_id = any($2)", [
      "order_e2e_af12c",
      affiliateIds,
    ])
    await softSql("ลบ affiliate ของ test", "delete from affiliate where id = any($1)", [affiliateIds])
    await softSql("ลบ program ของ test", "delete from affiliate_program where id = any($1)", [programIds])
    const left = await softSql("นับ affiliate ที่เหลือ", "select count(*)::int as count from affiliate where id = any($1)", [affiliateIds])
    expect.soft(left[0]?.count, "affiliate ของ test ต้องถูกลบหมด").toBe(0)
  }
})
