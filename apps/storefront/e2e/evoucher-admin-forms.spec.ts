import { APIRequestContext, Page, Route } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// EV-9 (spec 02 กฎข้อ 11, AC-20): ฟอร์ม partner/pool ใน admin กัน double-submit และ Label ผูก htmlFor/id
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — input หาด้วย getByLabel ตามที่ AC-20 กำหนด
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-9" } })

const PARTNERS_PATH = "/admin/evoucher/partners"

const PARTNER_LABELS = ["Name *", "Logo URL", "Terms URL", "Support contact"]
const POOL_LABELS = [
  "Partner *",
  "Name *",
  "How to use * (shown in the delivery email)",
  "Face value",
  "Validity note",
  "Low-stock threshold",
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(request: APIRequestContext, headers: Headers, path: string, data?: object): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

test("AC-20: dblclick Save ของ Create partner → POST 1 ครั้ง partner ใหม่ 1 แถว; input ของฟอร์ม partner/pool หาได้ด้วย getByLabel", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  // ADM-5: ตาราง Partners แบ่งหน้าละ 20 และเรียงตามชื่อ — ขึ้นต้นด้วย "000" ให้อยู่หน้าแรกแม้ DB มี partner สะสม
  // (และลบทิ้งท้าย step ไม่ให้สะสมเอง)
  const name = `000 EV-9 partner ${Date.now()}`

  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === PARTNERS_PATH) posts.push(req.url())
  })
  // หน่วง response ของ POST แรกไว้จนกว่า test ปล่อย เพื่อพิสูจน์ว่าปุ่ม disabled ระหว่างรอ
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  let heldOnce = false
  await page.route(`**${PARTNERS_PATH}`, async (route) => {
    if (route.request().method() === "POST" && !heldOnce) {
      heldOnce = true
      await held
    }
    await route.continue()
  })

  await step("เปิดฟอร์ม Create partner → ทุก input หาได้ด้วย label", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }).click()
    for (const label of PARTNER_LABELS) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }
    await page.getByLabel("Name *", { exact: true }).fill(name)
  })

  await step("dblclick Save → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ แล้วมี partner ใหม่ 1 แถว", async () => {
    const save = page.getByRole("button", { name: "Save" })
    await save.dblclick()
    await expect(save).toBeDisabled()
    await evidence("01-partner-save-disabled")
    expect(posts).toHaveLength(1)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === PARTNERS_PATH
    )
    release()
    expect((await response).status()).toBe(200)
    await expect(page.getByTestId("evoucher-partners").getByText(name, { exact: true })).toHaveCount(1)
    expect(posts).toHaveLength(1)
    const { partners } = await call(request, admin, `${PARTNERS_PATH}?limit=100&order=-created_at`)
    const created = partners.filter((p: { name: string }) => p.name === name)
    expect(created).toHaveLength(1)
    await request.delete(`${BACKEND_URL}${PARTNERS_PATH}/${created[0].id}`, { headers: admin })
  })

  await step("ฟอร์ม Create pool บนหน้า variant → ทุก input หาได้ด้วย label", async () => {
    const { product } = await call(request, admin, "/admin/products", {
      title: `EV-9 voucher ${Date.now()}`,
      options: [{ title: "Value", values: ["500"] }],
      variants: [{ title: "500 THB", options: { Value: "500" }, prices: [{ currency_code: "thb", amount: 500 }] }],
    })
    await page.goto(`${BACKEND_URL}/app/products/${product.id}/variants/${product.variants[0].id}`)
    await page.getByRole("button", { name: "Create pool" }).click()
    for (const label of POOL_LABELS) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }
    await evidence("02-pool-form-labels")
  })
})

// ADM-21a (spec 08 AC-25, กฎ 25): query รายการของหน้า /app/evouchers ล้มและไม่มีข้อมูลในมือ → error ใน emptyState ของ DataTable
// (คงหัวตาราง + ปุ่ม Create partner) แทนข้อความ empty เดิม; 401 → ErrorBoundary ของ dashboard พาไป /login
test.describe("ADM-21a: สถานะ error ของตาราง pools / partners", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-21a" } })

  type Fail = (route: Route) => Promise<void>
  const fail500: Fail = (route) =>
    route.fulfill({ status: 500, json: { type: "unknown_error", message: "An unknown error occurred." } })
  const failAbort: Fail = (route) => route.abort()
  const fail401: Fail = (route) => route.fulfill({ status: 401, json: { type: "unauthorized", message: "Unauthorized" } })

  // GET รายการเท่านั้น (`pools?…` ไม่ match `/pools/<id>`; POST/DELETE ของ partner ผ่านปกติ)
  const TABLES = {
    pools: { route: "**/admin/evoucher/pools?*", empty: { pools: [], count: 0, offset: 0, limit: 20 } },
    partners: { route: "**/admin/evoucher/partners*", empty: { partners: [], count: 0, offset: 0, limit: 20 } },
  }
  const onGet = (page: Page, table: keyof typeof TABLES, handle: Fail) =>
    page.route(TABLES[table].route, (route) => (route.request().method() === "GET" ? handle(route) : route.continue()))

  async function expectPoolsError(page: Page) {
    const error = page.getByTestId("evoucher-pools-error")
    await expect(error).toBeVisible()
    await expect(error).toContainText("Could not load voucher pools")
    await expect(error.getByRole("heading", { name: "E-voucher pools" })).toBeVisible()
    await expect(page.getByTestId("evoucher-partners")).toBeVisible()
    await expect(page.locator("body")).not.toContainText("No voucher pools yet")
  }

  async function expectPartnersError(page: Page) {
    const table = page.getByTestId("evoucher-partners-table")
    await expect(page.getByTestId("evoucher-partners-error")).toBeVisible()
    await expect(table.getByTestId("evoucher-partners-error")).toContainText("Could not load partners")
    await expect(table.getByRole("heading", { name: "Partners" })).toBeVisible()
    await expect(page.getByTestId("evoucher-partners-empty")).toHaveCount(0)
    // spec 08 กฎ 18: ปุ่มใน action ของ DataTable ไม่รับ data-testid → หาด้วย role + ชื่อภายใน wrapper
    const create = table.getByRole("button", { name: "Create partner" })
    await expect(create).toBeEnabled()
    await create.click()
    await expect(page.getByLabel("Name *", { exact: true })).toBeVisible()
  }

  for (const [name, fail] of [
    ["ตอบ 500", fail500],
    ["network ล้ม (route.abort)", failAbort],
  ] as const) {
    test(`AC-25: GET pools ${name} → evoucher-pools-error แทน "No voucher pools yet" คงหัวตาราง`, async ({ page, evidence }) => {
      await loginAdmin(page)
      await onGet(page, "pools", fail)
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      await expectPoolsError(page)
      if (fail === fail500) await evidence("01-pools-error-500")
    })

    test(`AC-25: GET partners ${name} → evoucher-partners-error ไม่มี evoucher-partners-empty ปุ่ม Create partner ยังใช้ได้`, async ({
      page,
      evidence,
    }) => {
      await loginAdmin(page)
      await onGet(page, "partners", fail)
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      await expect(page.getByTestId("evoucher-partners-error")).toBeVisible()
      if (fail === fail500) await evidence("02-partners-error-500")
      await expectPartnersError(page)
    })
  }

  for (const table of ["pools", "partners"] as const) {
    test(`AC-25: GET ${table} ตอบ 401 → ErrorBoundary พาไป /app/login`, async ({ page }) => {
      await loginAdmin(page)
      await onGet(page, table, fail401)
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      // จบ test ทันทีหลังถึงหน้า login (spec 08 AC-25)
      await page.waitForURL(/\/app\/login/)
    })
  }

  test("AC-25: pools/partners ตอบรายการว่าง → empty state เดิม ไม่มี testid error", async ({ page, evidence }) => {
    await loginAdmin(page)
    for (const table of ["pools", "partners"] as const) {
      await onGet(page, table, (route) => route.fulfill({ status: 200, json: TABLES[table].empty }))
    }
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    await expect(page.getByTestId("evoucher-partners-empty")).toBeVisible()
    await expect(page.locator("body")).toContainText("No voucher pools yet")
    await expect(page.getByTestId("evoucher-pools-error")).toHaveCount(0)
    await expect(page.getByTestId("evoucher-partners-error")).toHaveCount(0)
    await evidence("03-pools-partners-empty")
  })
})

// ADM-23 (spec 08 AC-28, กฎ 27): `?partners_offset=` เกินจำนวนแถว — request แรกได้ 0 แถว (count > 0) ก่อน usePageOffset clamp
// เคยแสดง "No partners on this page" กระพริบ (#359) → ตารางอยู่ในสถานะ loading แทน; และ Edit จากเมนูต่อแถวแล้วปิด Drawer
// ต้องไม่ทิ้ง `pointer-events: none` ค้างบน body (PartnerActions remount เมนูแบบ ProgramActions — review #359)
test.describe("ADM-23: partners clamp ไม่กระพริบ + เมนูต่อแถว", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-23" } })

  const EMPTY_TEXT = "No partners on this page"
  const PAGE_SIZE = 20
  const emptySeen = (page: Page) => page.evaluate(() => (window as unknown as { __emptySeen: number[] }).__emptySeen)

  test("AC-28: ?partners_offset=99999999 + GET partners หน่วง 800ms → ไม่มี empty ตลอด 2 วินาทีแรก จบหน้าสุดท้าย; Edit แล้ว Escape ไม่ค้าง pointer-events", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const name = `000 ADM-23 partner ${Date.now()}`
    const { partner } = await call(request, admin, PARTNERS_PATH, { name })
    const rows = page.getByTestId("evoucher-partners-table").locator("tbody tr")

    try {
      const { count } = await call(request, admin, `${PARTNERS_PATH}?limit=1&offset=0`)
      const lastPage = Math.floor((count - 1) / PAGE_SIZE) * PAGE_SIZE
      // usePageOffset: offset 0 = ลบ param ออกจาก URL
      const expectedParam = lastPage ? String(lastPage) : null

      await loginAdmin(page)
      // MutationObserver บันทึกทุกครั้งที่ DOM เปลี่ยนแล้วมีข้อความ empty (กระพริบ 1 frame ก็นับ) ตั้งแต่ก่อน script ของหน้า
      await page.addInitScript((text) => {
        const w = window as unknown as { __emptySeen: number[] }
        w.__emptySeen = []
        new MutationObserver(() => {
          if (document.body?.textContent?.includes(text)) w.__emptySeen.push(performance.now())
        }).observe(document, { childList: true, subtree: true, characterData: true })
      }, EMPTY_TEXT)
      await page.route(`**${PARTNERS_PATH}*`, async (route) => {
        if (route.request().method() === "GET") await new Promise((resolve) => setTimeout(resolve, 800))
        await route.continue()
      })

      await step("เปิด ?partners_offset=99999999 → 2 วินาทีแรกไม่มี empty", async () => {
        await page.goto(`${BACKEND_URL}/app/evouchers?partners_offset=99999999`)
        await page.waitForTimeout(2_000)
        expect(await emptySeen(page)).toEqual([])
      })

      await step(`จบที่ partners_offset=${lastPage} (หน้าสุดท้าย) มีแถว และยังไม่เคยมี empty`, async () => {
        await page.waitForURL((url) => url.searchParams.get("partners_offset") === expectedParam)
        await expect(rows.first()).toBeVisible()
        await expect(page.getByTestId("evoucher-partners")).not.toContainText(EMPTY_TEXT)
        expect(await emptySeen(page)).toEqual([])
        await evidence("01-partners-offset-clamped-no-empty-flash")
      })

      await step("เมนูต่อแถว → Edit → Escape ปิด Drawer → body ไม่มี pointer-events: none และ Create partner เปิด modal ได้", async () => {
        await page.goto(`${BACKEND_URL}/app/evouchers`)
        const row = page.getByTestId("evoucher-partners-table").locator("tbody tr", { hasText: name })
        await row.getByTestId("evoucher-partner-row-actions").click()
        await page.getByRole("menuitem", { name: "Edit" }).click()
        const drawer = page.getByRole("dialog")
        await expect(drawer.getByText("Edit partner")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(drawer).toHaveCount(0)
        await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none")
        await page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }).click()
        await expect(page.getByLabel("Name *", { exact: true })).toBeVisible()
        await evidence("02-partner-edit-escape-create-opens")
      })
    } finally {
      // AC-99 (core-4g hygiene): ลบข้อมูลของ test แล้วตรวจ ok() — soft ไม่บัง error เดิมของ test
      const res = await request.delete(`${BACKEND_URL}${PARTNERS_PATH}/${partner.id}`, { headers: admin })
      expect.soft(res.ok(), `ลบ partner ของ test: ${res.status()}`).toBe(true)
    }
  })
})

// ADM-19 (spec 08 AC-23, กฎ 23): `?partners_offset=` ผิดรูปตอนไม่มี partner — PageOffsetGate ซ่อนตาราง + ปุ่มใน action
// จนกว่า usePageOffset จะลบ param ออกจาก URL แล้วต้องกลับมาเอง (ไม่ reload / ไม่แก้ URL ด้วยมือ) — test กันถอย (กฎ 23: ไม่แก้โค้ดถ้าผ่าน)
test.describe("ADM-19: partners_offset ผิดรูปตอนไม่มี partner", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-19" } })

  for (const offset of ["abc", "-50"]) {
    test(`AC-23: GET partners ว่าง + ?partners_offset=${offset} → URL ไม่มี param, ปุ่ม Create partner 1 ตัว, empty state, ไม่มี NaN; กดปุ่มแล้ว modal เปิด`, async ({
      page,
      evidence,
    }) => {
      await loginAdmin(page)
      await page.route("**/admin/evoucher/partners*", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ status: 200, json: { partners: [], count: 0, offset: 0, limit: 20 } })
          : route.continue()
      )
      await page.goto(`${BACKEND_URL}/app/evouchers?partners_offset=${offset}`)

      await page.waitForURL((url) => url.pathname === "/app/evouchers" && !url.searchParams.has("partners_offset"))
      const table = page.getByTestId("evoucher-partners-table")
      // spec 08 กฎ 18: ปุ่มใน action ของ DataTable หาด้วย role + ชื่อภายใน wrapper
      const create = table.getByRole("button", { name: "Create partner" })
      await expect(create).toHaveCount(1)
      await expect(page.getByTestId("evoucher-partners-empty")).toBeVisible()
      await expect(table).not.toContainText(/NaN/)
      expect(new URL(page.url()).searchParams.has("partners_offset")).toBe(false)
      if (offset === "abc") {
        await table.scrollIntoViewIfNeeded()
        await evidence("01-partners-bad-offset-empty")
      }

      await create.click()
      await expect(page.getByLabel("Name *", { exact: true })).toBeVisible()
      if (offset === "abc") await evidence("02-partners-bad-offset-create-modal")
    })
  }
})
