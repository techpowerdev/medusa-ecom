import { APIRequestContext, Page, Route } from "@playwright/test"
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
const AFFILIATES = "/admin/affiliate/affiliates"
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
      await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
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

    await step("เปิดแก้โปรแกรม → option ของ collection นอกหน้าแรกถูกเลือกอยู่ (aria-selected) และ Save ไม่ทำ scope หาย", async () => {
      await (await rowAction(page.getByRole("row").filter({ hasText: `ADM-9 ${tag}` }), "affiliate-program-row-actions", "Edit")).click()
      // ADM-17 (spec 08 กฎ 21): ตรวจที่ option ใน combobox ไม่ใช่แค่ body ของ POST
      await field("collection_ids").click()
      await expect(page.getByRole("option", { name: `ADM9 ${tag} col 249` })).toHaveAttribute("aria-selected", "true")
      await field("name").click()
      await expect(page.getByRole("listbox")).toBeHidden()
      await field("name").fill(`ADM-9 ${tag} v2`)
      const updated = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${PROGRAMS}/${programId}`)
      await save.click()
      const response = await updated
      expect(response.status()).toBe(200)
      expect(response.request().postDataJSON().scope.collection_ids).toEqual([target])
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
      const response = await updated
      expect(response.status()).toBe(200)
      const body = response.request().postDataJSON()
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

test("AC-12/AC-21: ฟอร์มสร้าง payout ค่าเริ่มต้นวันที่ 1 ของเดือนก่อน 00:00 ตามเวลาเครื่อง และค้น affiliate รายที่ 250 ด้วย q แล้วเลือกได้", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  await adminHeaders(request)
  const tag = `adm9${Date.now()}`
  // ADM-24: ตัวเลือกเรียงตามชื่อ (order=name) — aff 249 คือรายที่ 250 ที่ limit 200 เดิมตัดทิ้งและไม่อยู่ในหน้าแรก
  await sql(
    `insert into affiliate (id, email, name, code, status, created_at, updated_at)
     select 'aff_' || $1 || '_' || i, $1 || '-' || i || '@example.com', 'ADM9 ' || $1 || ' aff ' || lpad(i::text, 3, '0'),
            $1 || '-' || i, 'active', now() + i * interval '1 second', now() + i * interval '1 second'
     from generate_series(0, $2::int - 1) i`,
    [tag, COUNT],
  )
  try {
    const posts: Json[] = []
    const lists: URL[] = []
    page.on("request", (req) => {
      const url = new URL(req.url())
      if (req.method() === "POST" && url.pathname === PAYOUTS) posts.push(req.postDataJSON())
      if (req.method() === "GET" && url.pathname === AFFILIATES) lists.push(url)
    })
    // ตามเวลาไทยของ browser (timezoneId) เดือนก่อน [วันที่ 1, วันที่ 1 ของเดือนนี้) เป็น 00:00 ICT
    const ict = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const [y, m] = [ict.getUTCFullYear(), ict.getUTCMonth()]
    const firstOf = (month: number) => new Date(Date.UTC(y, month, 1) - 7 * 60 * 60 * 1000)
    const local = (month: number) => `${new Date(Date.UTC(y, month, 1)).toISOString().slice(0, 10)}T00:00`

    await step("ค่าเริ่มต้นของช่วงเป็นเดือนก่อน 00:00 ตามเวลาเครื่อง", async () => {
      await openAffiliatePage(page)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
      await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_from"), local(m - 1))
      await expectDatePicker(page.getByTestId("affiliate-payout-field-period_to"), local(m))
    })

    await step("พิมพ์ชื่อรายที่ 250 → ค้นด้วย q (ไม่ดึง limit=200 หลายหน้า) เลือกได้ และ POST ส่ง id กับช่วงค่าเริ่มต้นเป็น UTC", async () => {
      const searched = page.waitForResponse((r) => new URL(r.url()).searchParams.get("q") === `${tag} aff 249`)
      await page.getByTestId("affiliate-payout-field-affiliate_id").fill(`${tag} aff 249`)
      await searched
      await page.getByRole("option").filter({ hasText: `${tag} aff 249` }).click()
      // ADM-17 (spec 08 AC-21): ค้นฝั่ง server ด้วย q และไม่มีการดึงทีละ 200 จนครบแบบเดิม
      expect(lists.some((url) => url.searchParams.get("q") === `${tag} aff 249`)).toBe(true)
      expect(lists.filter((url) => url.searchParams.get("limit") === "200")).toEqual([])
      const created = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PAYOUTS)
      await page.getByTestId("affiliate-payout-save").click()
      await created
      expect(posts).toEqual([
        {
          affiliate_id: `aff_${tag}_249`,
          period_from: firstOf(m - 1).toISOString(),
          period_to: firstOf(m).toISOString(),
        },
      ])
    })
  } finally {
    await sql(`delete from affiliate where id like $1`, [`aff_${tag}_%`])
  }
})

test("AC-21: GET รายชื่อ affiliate ล้ม → error ใต้ช่อง affiliate ของฟอร์ม payout (ไม่ใช่รายการว่างเงียบ)", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  await adminHeaders(request)
  await step("route รายชื่อ affiliate ตอบ 500 → ข้อความ error ใต้ช่อง", async () => {
    await openAffiliatePage(page)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await page.route(`${BACKEND_URL}${AFFILIATES}?**`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ type: "unknown_error", message: "boom" }) }),
    )
    await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
    // react-query ของ dashboard retry ก่อนแสดง error
    await expect(page.getByTestId("affiliate-payout-options-error")).toContainText(/\S/, { timeout: 30_000 })
  })
})

// ADM-24 (spec 08 AC-29, กฎ 28b/c): ตัวเลือก affiliate ของฟอร์ม payout = request เดียวต่อหน้า (active + suspended, order=name)
// JS SDK (qs) ส่ง array เป็น status[0]=…&status[1]=… — อ่านค่าจาก searchParams ที่ parse แล้ว ไม่เทียบ string ดิบ
const statusesOf = (url: URL) =>
  Array.from(url.searchParams.entries())
    .filter(([key]) => /^status(\[\d*\])?$/.test(key))
    .map(([, value]) => value)
    .sort()
// request ของรายการตัวเลือก (ไม่ใช่ id[] ของชื่อในตาราง payouts / id ของตัวที่เลือกไว้)
const isOptionList = (url: URL) =>
  url.pathname === AFFILIATES && statusesOf(url).length > 0 && !url.searchParams.has("id")

test.describe("ADM-24: ตัวเลือก affiliate ของฟอร์ม payout", () => {
  const openPayoutForm = async (page: Page) => {
    await openAffiliatePage(page)
    await page.getByTestId("affiliate-admin-tab-payouts").click()
    await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
  }

  test("AC-29: request เดียวต่อหน้ามีทั้ง active และ suspended + order=name และ option ตรงลำดับของ response", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    await adminHeaders(request)
    const tag = `adm24${Date.now()}`
    // ชื่อคละลำดับกับ created_at และสถานะ — pending ต้องไม่อยู่ในตัวเลือก
    const rows = [
      ["Delta", "active"],
      ["Alpha", "pending"],
      ["Bravo", "suspended"],
      ["Echo", "suspended"],
      ["Charlie", "active"],
      ["Foxtrot", "pending"],
    ] as const
    for (let i = 0; i < rows.length; i++) {
      const [name, status] = rows[i]
      await sql(
        `insert into affiliate (id, email, name, code, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now() + $6 * interval '1 second', now())`,
        [`aff_${tag}_${i}`, `${tag}-${i}@example.com`, `${tag} ${name}`, `${tag}-${i}`, status, i],
      )
    }
    try {
      const lists: URL[] = []
      page.on("request", (req) => {
        const url = new URL(req.url())
        if (req.method() === "GET" && url.pathname === AFFILIATES) lists.push(url)
      })

      await step("เปิด combobox → รายการต่อหน้าเป็น request เดียวที่มี active+suspended และ order=name", async () => {
        // useComboboxData ยิงหน้าแรกตั้งแต่ modal เปิด
        const first = page.waitForResponse((r) => r.request().method() === "GET" && isOptionList(new URL(r.url())))
        await openPayoutForm(page)
        await first
        await page.getByTestId("affiliate-payout-field-affiliate_id").click()
        await expect(page.getByRole("listbox")).toBeVisible()
      })

      await step("ค้นด้วย tag → option เรียงตามลำดับ affiliates ของ response (เฉพาะ active/suspended เรียงชื่อ)", async () => {
        const searched = page.waitForResponse((r) => {
          const url = new URL(r.url())
          return r.request().method() === "GET" && isOptionList(url) && url.searchParams.get("q") === tag
        })
        await page.getByTestId("affiliate-payout-field-affiliate_id").fill(tag)
        const body = await (await searched).json()
        const names = body.affiliates.map((a: Json) => a.name)
        expect(names).toEqual(["Bravo", "Charlie", "Delta", "Echo"].map((n) => `${tag} ${n}`))
        const labels = body.affiliates.map(
          (a: Json) => `${a.name} (${a.email})${a.status === "suspended" ? " — suspended" : ""}`,
        )
        await expect(page.getByRole("option")).toHaveText(labels)
      })

      await step("ทุก request ของรายการ: status = active+suspended ใน request เดียว, order=name, ไม่มี request แยกสถานะ", async () => {
        const optionLists = lists.filter(isOptionList)
        expect(optionLists.length).toBeGreaterThan(0)
        for (const url of optionLists) {
          expect(statusesOf(url)).toEqual(["active", "suspended"])
          expect(url.searchParams.get("order")).toBe("name")
        }
        // request ที่มี status แค่ค่าเดียว (คู่ request แบบเดิม) ต้องไม่มี
        expect(lists.filter((url) => statusesOf(url).length === 1)).toEqual([])
      })
    } finally {
      await sql(`delete from affiliate where id like $1`, [`aff_${tag}_%`])
    }
  })

  test("AC-29: GET รายการตัวเลือกตอบ 401 → ErrorBoundary พาไป /app/login", async ({ page, request }) => {
    test.setTimeout(120_000)
    await adminHeaders(request)
    await loginAdmin(page)
    await page.route(`${BACKEND_URL}${AFFILIATES}?**`, (route) =>
      route.request().method() === "GET" && isOptionList(new URL(route.request().url()))
        ? route.fulfill({ status: 401, json: { type: "unauthorized", message: "Unauthorized" } })
        : route.continue(),
    )
    await openPayoutForm(page)
    // จบ test ทันทีหลังถึงหน้า login (spec 08 AC-29)
    await page.waitForURL(/\/app\/login/)
  })
})

// ADM-21b (spec 08 AC-26, กฎ 25): GET รายการของแท็บ affiliate ล้มและไม่มีข้อมูลในมือ → affiliate-list-error ใน emptyState ของ
// DataTable (คงหัวตาราง + ปุ่มสร้างใน action) แทนข้อความ empty เดิม; 401 → ErrorBoundary ของ dashboard พาไป /login
test.describe("ADM-21b: สถานะ error ของตาราง affiliate ทุกแท็บ", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-21b" } })

  type Fail = (route: Route) => Promise<void>
  const fail500: Fail = (route) =>
    route.fulfill({ status: 500, json: { type: "unknown_error", message: "An unknown error occurred." } })
  const failAbort: Fail = (route) => route.abort()

  // แท็บ → resource ของ GET (`/admin/affiliate/<resource>`), heading, ข้อความ empty เดิม, wrapper + ปุ่มสร้างใน action (กฎ 18)
  const TABS = [
    { tab: "programs", resource: "programs", heading: "Programs", empty: "No programs yet", create: ["affiliate-programs-table", "Create program"], shot: "01-programs-error-500" },
    { tab: "affiliates", resource: "affiliates", heading: "Affiliates", empty: "No affiliates yet" },
    { tab: "ledger", resource: "entries", heading: "Ledger", empty: "No commission entries yet" },
    { tab: "payouts", resource: "payouts", heading: "Payouts", empty: "No payouts yet", create: ["affiliate-payouts-table", "Create payout"], shot: "02-payouts-error-500" },
  ] as const

  const onGet = (page: Page, resource: string, handle: Fail) =>
    page.route(`**/admin/affiliate/${resource}?*`, (route) =>
      route.request().method() === "GET" ? handle(route) : route.continue()
    )

  const openTab = async (page: Page, tab: string) => {
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId(`affiliate-admin-tab-${tab}`).click()
  }

  for (const t of TABS) {
    for (const [name, fail] of [
      ["ตอบ 500", fail500],
      ["network ล้ม (route.abort)", failAbort],
    ] as const) {
      test(`AC-26: แท็บ ${t.tab} GET ${t.resource} ${name} → affiliate-list-error แทน "${t.empty}"`, async ({ page, evidence }) => {
        await loginAdmin(page)
        await onGet(page, t.resource, fail)
        await openTab(page, t.tab)
        const error = page.getByTestId("affiliate-list-error")
        await expect(error).toBeVisible()
        await expect(error).toContainText(`Could not load ${t.resource}`)
        await expect(error.getByRole("heading", { name: t.heading })).toBeVisible()
        await expect(page.locator("body")).not.toContainText(t.empty)
        if ("create" in t) {
          const [wrapper, label] = t.create
          await expect(page.getByTestId(wrapper).getByRole("button", { name: label })).toBeEnabled()
        }
        if (fail === fail500 && "shot" in t) await evidence(t.shot)
      })
    }
  }

  test("AC-26: GET payouts ตอบ 401 → ErrorBoundary พาไป /app/login", async ({ page }) => {
    await loginAdmin(page)
    await onGet(page, "payouts", (route) =>
      route.fulfill({ status: 401, json: { type: "unauthorized", message: "Unauthorized" } })
    )
    await openTab(page, "payouts")
    // จบ test ทันทีหลังถึงหน้า login (spec 08 AC-26)
    await page.waitForURL(/\/app\/login/)
  })

  test("AC-26: ทุกแท็บตอบรายการว่าง → empty state เดิม ไม่มี affiliate-list-error", async ({ page }) => {
    await loginAdmin(page)
    for (const t of TABS) {
      await onGet(page, t.resource, (route) =>
        route.fulfill({ status: 200, json: { [t.resource]: [], count: 0, offset: 0, limit: 20 } })
      )
    }
    for (const t of TABS) {
      await openTab(page, t.tab)
      await expect(page.locator("body")).toContainText(t.empty)
      await expect(page.getByTestId("affiliate-list-error")).toHaveCount(0)
    }
  })
})

// ADM-26 (spec 08 AC-31, กฎ 30): ขณะ Combobox ขยายใน FocusModal Escape ไม่ปิด modal และค่าที่กรอกคงอยู่; ไม่ assert ว่า Escape
// ปิด listbox (ข้อจำกัดที่ยอมรับ กฎ 30d) — ปิดรายการด้วยการเลือก option / คลิก heading ใน dialog แล้ว Escape ปิด modal ตามเดิม
// option ของ Combobox และ heading หาด้วย role (ข้อยกเว้นของ testid)
test.describe("ADM-26: Escape ของ Combobox ใน FocusModal", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-26" } })

  // Date.now() ชนกันได้เมื่อรัน --repeat-each หลาย worker พร้อมกัน
  const uniqueTag = () => `adm26${Date.now()}${Math.random().toString(36).slice(2, 8)}`

  const openList = async (page: Page, combobox: string) => {
    await page.getByTestId(combobox).click()
    await expect(page.getByRole("listbox")).toBeVisible()
    await expect(page.getByTestId(combobox)).toHaveAttribute("aria-expanded", "true")
  }

  // รายการปิดแล้ว (listbox ไม่ visible และ input ไม่ขยาย) → Escape ปิด modal
  const escapeClosesModal = async (page: Page, combobox: string) => {
    await expect(page.getByRole("listbox")).toBeHidden()
    await expect(page.getByTestId(combobox)).not.toHaveAttribute("aria-expanded", "true")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }

  test("AC-31a: ฟอร์ม payout — Escape ขณะรายการ affiliate เปิดไม่ปิด modal และช่วงวันที่คงอยู่; เลือก option แล้ว Escape ปิด modal", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await adminHeaders(request)
    const tag = uniqueTag()
    const combobox = "affiliate-payout-field-affiliate_id"
    const from = page.getByTestId("affiliate-payout-field-period_from")
    await sql(
      `insert into affiliate (id, email, name, code, status, created_at, updated_at)
       values ($1, $2, $3, $4, 'active', now(), now())`,
      [`aff_${tag}`, `${tag}@example.com`, `ADM26 ${tag}`, tag],
    )
    try {
      await step("กรอก From แล้วเปิดรายการ affiliate → Escape: dialog ยังเปิดและ From คงค่าที่กรอก", async () => {
        await openAffiliatePage(page)
        await page.getByTestId("affiliate-admin-tab-payouts").click()
        await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
        await expect(page.getByRole("dialog")).toBeVisible()
        await fillDatePicker(from, "2026-03-05T09:15")
        await openList(page, combobox)
        await page.keyboard.press("Escape")
        await expect(page.getByRole("dialog")).toBeVisible()
        await expectDatePicker(from, "2026-03-05T09:15")
        await evidence("01-payout-escape-keeps-modal")
      })

      await step("ค้นด้วย tag แล้วเลือก option ปิดรายการ → Escape ปิด modal (พฤติกรรมเดิม)", async () => {
        // ค้นก่อนเลือก — affiliate ของ test อาจไม่อยู่ในหน้าแรกของตัวเลือกเมื่อ DB มีข้อมูลอื่น
        await page.getByTestId(combobox).fill(tag)
        await page.getByRole("option").filter({ hasText: tag }).click()
        await escapeClosesModal(page, combobox)
      })
    } finally {
      await sql(`delete from affiliate where id = $1`, [`aff_${tag}`])
    }
  })

  test("AC-31b: ฟอร์ม program — Escape ขณะรายการ scope เปิดไม่ปิด modal และชื่อคงอยู่; คลิก heading ปิดรายการแล้ว Escape ปิด modal", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await adminHeaders(request)
    const tag = uniqueTag()
    const combobox = "affiliate-program-field-collection_ids"
    const name = page.getByTestId("affiliate-program-field-name")
    await sql(
      `insert into product_collection (id, title, handle, created_at, updated_at) values ($1, $2, $3, now(), now())`,
      [`pcol_${tag}`, `ADM26 ${tag}`, tag],
    )
    try {
      await step("กรอกชื่อ ปิด all แล้วเปิดรายการ collection → Escape: dialog ยังเปิดและชื่อคงอยู่", async () => {
        await openAffiliatePage(page)
        await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
        await expect(page.getByRole("dialog")).toBeVisible()
        await name.fill(`ADM-26 ${tag}`)
        await page.getByTestId("affiliate-program-scope-all").click()
        await openList(page, combobox)
        await page.keyboard.press("Escape")
        await expect(page.getByRole("dialog")).toBeVisible()
        await expect(name).toHaveValue(`ADM-26 ${tag}`)
        await evidence("02-program-escape-keeps-modal")
      })

      // scope เป็น multi-select: คลิก option ไม่ปิดรายการ จึงปิดด้วยการคลิก heading ภายใน dialog (review #378)
      await step("คลิก heading ใน dialog ปิดรายการ → Escape ปิด modal (พฤติกรรมเดิม)", async () => {
        await page.getByRole("dialog").getByRole("heading", { name: "Create program" }).click()
        await escapeClosesModal(page, combobox)
      })
    } finally {
      await sql(`delete from product_collection where id = $1`, [`pcol_${tag}`])
    }
  })
})
