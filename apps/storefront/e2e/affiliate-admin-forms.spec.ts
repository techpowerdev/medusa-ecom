import { APIRequestContext, Page } from "@playwright/test"
import { Client } from "pg"

import { ADMIN_UI_OPTIONS, expectDatePicker, fillDatePicker, loginAdmin, rowAction } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// ADM-9 (spec 08 AC-12, กฎ 5, 8, 11): ฟอร์ม affiliate ใช้ DatePicker / Combobox — ข้อมูล 250 รายการใส่ตรงใน DB
// (สร้างผ่าน API ช้าเกินความจำเป็น) แล้วลบเองหลัง test; หา element ด้วย data-testid ยกเว้น menuitem ของ ActionMenu และ option ของ Combobox
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-9" },
})

const PROGRAMS = "/admin/affiliate/programs"
const PAYOUTS = "/admin/affiliate/payouts"
const COUNT = 250

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function sql(text: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(text, values)
  } finally {
    await db.end()
  }
}

async function call(request: APIRequestContext, admin: Headers, path: string, data?: object): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers: admin })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

const openAffiliatePage = async (page: Page) => {
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/affiliate`)
}

test("AC-12: ปิด all โดยไม่เลือก scope → error ไม่มี request; collection ลำดับที่ 250 ค้นหาแล้วเลือกได้; starts_at ตีความตามเวลาเครื่อง", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const tag = `adm9${Date.now()}`
  const target = `pcol_${tag}_249`
  await sql(
    `insert into product_collection (id, title, handle, created_at, updated_at)
     select 'pcol_' || $1 || '_' || i, 'ADM9 ' || $1 || ' col ' || lpad(i::text, 3, '0'), $1 || '-' || i,
            now() + i * interval '1 second', now() + i * interval '1 second'
     from generate_series(0, $2::int - 1) i`,
    [tag, COUNT],
  )
  let programId = ""
  try {
    const posts: Json[] = []
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === PROGRAMS) posts.push(req.postDataJSON())
    })
    const field = (key: string) => page.getByTestId(`affiliate-program-field-${key}`)
    const save = page.getByTestId("affiliate-program-save")

    await step("ปิด all โดยไม่เลือก collection/category → error ใต้ช่อง scope และไม่มี POST", async () => {
      await openAffiliatePage(page)
      await page.getByTestId("affiliate-program-create").click()
      await field("name").fill(`ADM-9 ${tag}`)
      await fillDatePicker(field("starts_at"), "2026-12-01T00:00")
      await fillDatePicker(field("ends_at"), "2026-12-31T23:30")
      await field("commission_value").fill("8")
      await page.getByTestId("affiliate-program-scope-all").click()
      await save.click()
      await expect(page.getByTestId("affiliate-program-error-collection_ids")).toBeVisible()
      expect(posts).toEqual([])
    })

    await step("พิมพ์ชื่อ collection ลำดับที่ 250 → เลือกได้, POST มี id นั้นและ starts_at เป็นเวลาไทย", async () => {
      await field("collection_ids").fill(`${tag} col 249`)
      await page.getByRole("option").filter({ hasText: `${tag} col 249` }).click()
      await expect(page.getByTestId("affiliate-program-error-collection_ids")).toBeHidden()
      const created = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PROGRAMS)
      await save.click()
      programId = (await (await created).json()).program.id
      expect(posts).toHaveLength(1)
      expect(posts[0].scope.collection_ids).toEqual([target])
      expect(posts[0].starts_at).toBe("2026-11-30T17:00:00.000Z")
      expect(posts[0].ends_at).toBe("2026-12-31T16:30:00.000Z")
      await expect(save).toBeHidden()
    })

    await step("เปิดแก้โปรแกรม → ฟอร์มมี collection ที่เลือกไว้ แม้อยู่นอกหน้าแรก (Save ไม่ทำ scope หาย)", async () => {
      await (await rowAction(page.getByRole("row").filter({ hasText: `ADM-9 ${tag}` }), "affiliate-program-row-actions", "Edit")).click()
      await field("name").fill(`ADM-9 ${tag} v2`)
      const updated = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${PROGRAMS}/${programId}`)
      await save.click()
      const body = (await updated).request().postDataJSON()
      expect(body.scope.collection_ids).toEqual([target])
    })
  } finally {
    await sql(`delete from product_collection where id like $1`, [`pcol_${tag}_%`])
    if (programId) {
      const res = await request.delete(`${BACKEND_URL}${PROGRAMS}/${programId}`, { headers: admin })
      expect(res.ok(), `ลบโปรแกรม ${programId}`).toBe(true)
    }
  }
})

test("AC-12: แก้แค่ชื่อของโปรแกรมที่ starts_at/ends_at มีวินาที → body ไม่มีสองช่องนี้และค่าเดิมไม่ถูกปัด", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `ADM-9 seconds ${Date.now()}`
  const starts_at = "2030-01-01T00:00:30.000Z"
  const ends_at = "2030-02-01T00:00:45.000Z"
  const { program } = await call(request, admin, PROGRAMS, { name, starts_at, ends_at, commission_value: 5, scope: { all: true } })
  try {
    const row = page.getByRole("row").filter({ hasText: name })
    await step("แก้ชื่อแล้ว Save → body ไม่มี starts_at/ends_at", async () => {
      await openAffiliatePage(page)
      await expect(row).toBeVisible({ timeout: 30_000 })
      await (await rowAction(row, "affiliate-program-row-actions", "Edit")).click()
      await expectDatePicker(page.getByTestId("affiliate-program-field-starts_at"), "2030-01-01T07:00")
      await page.getByTestId("affiliate-program-field-name").fill(`${name} v2`)
      const updated = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${PROGRAMS}/${program.id}`)
      await page.getByTestId("affiliate-program-save").click()
      const body = (await updated).request().postDataJSON()
      expect(body.name).toBe(`${name} v2`)
      expect(body).not.toHaveProperty("starts_at")
      expect(body).not.toHaveProperty("ends_at")
    })

    await step("ค่าใน API ยังมีวินาทีเดิม", async () => {
      const { program: stored } = await call(request, admin, `${PROGRAMS}/${program.id}`)
      expect(stored.starts_at).toBe(starts_at)
      expect(stored.ends_at).toBe(ends_at)
    })
  } finally {
    const res = await request.delete(`${BACKEND_URL}${PROGRAMS}/${program.id}`, { headers: admin })
    expect(res.ok(), `ลบโปรแกรม ${program.id}`).toBe(true)
  }
})

test("AC-12: ฟอร์มสร้าง payout ค่าเริ่มต้นวันที่ 1 ของเดือนก่อน 00:00 ตามเวลาเครื่อง และเลือก affiliate รายที่ 250 ได้", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  await adminHeaders(request)
  const tag = `adm9${Date.now()}`
  // created_at เพิ่มตาม i และ route เรียง -created_at — i = 0 คือรายที่ 250 ที่ limit 200 เดิมตัดทิ้ง
  await sql(
    `insert into affiliate (id, email, name, code, status, created_at, updated_at)
     select 'aff_' || $1 || '_' || i, $1 || '-' || i || '@example.com', 'ADM9 ' || $1 || ' aff ' || lpad(i::text, 3, '0'),
            $1 || '-' || i, 'active', now() + i * interval '1 second', now() + i * interval '1 second'
     from generate_series(0, $2::int - 1) i`,
    [tag, COUNT],
  )
  try {
    const posts: Json[] = []
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === PAYOUTS) posts.push(req.postDataJSON())
    })
    // ตามเวลาไทยของ browser (timezoneId) เดือนก่อน [วันที่ 1, วันที่ 1 ของเดือนนี้) เป็น 00:00 ICT
    const ict = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const [y, m] = [ict.getUTCFullYear(), ict.getUTCMonth()]
    const firstOf = (month: number) => new Date(Date.UTC(y, month, 1) - 7 * 60 * 60 * 1000)
    const local = (month: number) => `${new Date(Date.UTC(y, month, 1)).toISOString().slice(0, 10)}T00:00`

    await step("ค่าเริ่มต้นของช่วงเป็นเดือนก่อน 00:00 ตามเวลาเครื่อง", async () => {
      await openAffiliatePage(page)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
      await page.getByTestId("affiliate-payout-create").click()
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_from"), local(m - 1))
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_to"), local(m))
    })

    await step("พิมพ์ชื่อรายที่ 250 → เลือกได้ และ POST ส่ง id กับช่วงค่าเริ่มต้นเป็น UTC", async () => {
      await page.getByTestId("affiliate-payout-field-affiliate_id").fill(`${tag} aff 000`)
      await page.getByRole("option").filter({ hasText: `${tag} aff 000` }).click()
      const created = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PAYOUTS)
      await page.getByTestId("affiliate-payout-save").click()
      await created
      expect(posts).toEqual([
        {
          affiliate_id: `aff_${tag}_0`,
          period_from: firstOf(m - 1).toISOString(),
          period_to: firstOf(m).toISOString(),
        },
      ])
    })
  } finally {
    await sql(`delete from affiliate where id like $1`, [`aff_${tag}_%`])
  }
})
