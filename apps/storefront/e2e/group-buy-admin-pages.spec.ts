import { APIRequestContext, Page, Route } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// ADM-6 (spec 08 AC-9): หน้า group buy ใช้ของ Medusa — breadcrumb จาก loader, รายการแคมเปญเป็น DataTable ของ dashboard
// (rowHref + หน้าอยู่ใน URL ด้วย prefix "gb") — admin UI เป็นภาษาอังกฤษ หา element ด้วย data-testid ยกเว้น breadcrumb
// และปุ่มแบ่งหน้าของ Medusa ที่ไม่มี testid (หาด้วย role + ชื่อ)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-6" } })

const HOUR = 60 * 60 * 1000
const BASE = `${BACKEND_URL}/admin/group-buy`
const PAGE_SIZE = 20
// ADM-25 (spec 08 AC-30, กฎ 29a): ข้อความของแถบแบ่งหน้า — ตอน error ต้องไม่มี ("0 of 0 results")
const PAGINATION_TEXT = /\d+ of \d+ (results|pages)/

async function tshirtId(request: APIRequestContext, admin: Headers): Promise<string> {
  // GB-6e (spec 04 กฎข้อ 30): 1 แคมเปญ = 1 สินค้า — ใช้สินค้า seed `t-shirt` ด้วย handle (CORE-46 กฎข้อ 104d)
  const res = await request.get(`${BACKEND_URL}/admin/products?handle=t-shirt&fields=id`, { headers: admin })
  expect(res.status(), "list products").toBe(200)
  const { products } = await res.json()
  expect(products, "สินค้า seed t-shirt").toHaveLength(1)
  return products[0].id
}

async function createCampaign(request: APIRequestContext, admin: Headers, productId: string, name: string) {
  const res = await request.post(`${BASE}/campaigns`, {
    headers: admin,
    data: {
      name,
      target_type: "orders",
      target_value: 3,
      group_mode: "pool",
      team_duration_hours: null,
      ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 10,
        value: 10,
        target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
      },
    },
  })
  expect(res.status(), "create campaign").toBe(200)
  return (await res.json()).campaign.id as string
}

async function listCampaigns(request: APIRequestContext, admin: Headers, offset: number) {
  const res = await request.get(`${BASE}/campaigns?limit=${PAGE_SIZE}&offset=${offset}`, { headers: admin })
  expect(res.status(), "list campaigns").toBe(200)
  return (await res.json()) as { campaigns: { id: string; name: string }[]; count: number }
}

test("AC-9: breadcrumb เป็นชื่อแคมเปญ (loader), คลิกแถวไปหน้ารายละเอียด, หน้า 2 อยู่ใน URL", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const productId = await tshirtId(request, admin)
  const token = `ADM-6 ${Date.now()}`
  const name = `${token} detail`
  // ต้องมีมากกว่า 1 หน้า (pageSize 20) — สร้างตัวเติมเท่าที่ขาดก่อน แล้วสร้าง `name` เป็นตัวสุดท้าย:
  // endpoint เรียง -created_at → `name` (ใหม่สุด) อยู่แถวแรกของหน้า 1 เสมอ แม้ DB ยังไม่มีแคมเปญ (review PR #293)
  const { count } = await listCampaigns(request, admin, 0)
  for (let i = count; i < PAGE_SIZE; i++) {
    await createCampaign(request, admin, productId, `${token} fill ${i}`)
  }
  const id = await createCampaign(request, admin, productId, name)

  const breadcrumb = page.locator("ol").first().locator("li")
  // Breadcrumbs ของ dashboard (shell.tsx): เมื่อมี > 1 ระดับ li สุดท้ายมี "..." (lg:hidden) + label → ดูเฉพาะ span ที่มองเห็น
  const breadcrumbLast = breadcrumb.last().locator("span:visible")
  const rows = page.getByTestId("gb-campaigns-table").locator("tbody tr")

  await step("เปิด /group-buying/:id → breadcrumb รายการสุดท้ายเป็นชื่อแคมเปญ", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
    await expect(page.getByTestId("gb-campaign-status")).toBeVisible({ timeout: 30_000 })
    // breadcrumb 2 ระดับ: "Group buying" (handle ของหน้ารายการ) › ชื่อแคมเปญ (loader)
    await expect(breadcrumb.first()).toHaveText("Group buying")
    await expect(breadcrumbLast).toHaveText(name)
    await evidence("01-detail-breadcrumb")
  })

  await step("รายการแคมเปญ: คลิกแถว → /group-buying/:id", async () => {
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    // `name` สร้างล่าสุด → อยู่หน้า 1 (filter ด้วยชื่อ ไม่ใช้ first() เพราะ spec อื่นที่รันขนานอาจสร้างแคมเปญใหม่กว่า)
    const row = rows.filter({ hasText: name })
    await expect(row).toHaveCount(1)
    await expect(rows).toHaveCount(PAGE_SIZE)
    await row.click()
    await page.waitForURL((url) => url.pathname === `/app/group-buying/${id}`)
    await expect(page.getByTestId("gb-campaign-status")).toBeVisible()
  })

  await step("กด Next → URL มี gb_offset=20 และ reload แล้วยังเป็นหน้า 2", async () => {
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    await expect(rows).toHaveCount(PAGE_SIZE)
    await page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Next", exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get("gb_offset") === String(PAGE_SIZE))
    const second = await listCampaigns(request, admin, PAGE_SIZE)
    await expect(rows.filter({ hasText: second.campaigns[0].name })).toHaveCount(1)
    await page.reload()
    expect(new URL(page.url()).searchParams.get("gb_offset")).toBe(String(PAGE_SIZE))
    await expect(rows.filter({ hasText: second.campaigns[0].name })).toHaveCount(1)
    await evidence("02-list-page-2")
  })

  await step("gb_offset ไม่ใช่ตัวเลข/ติดลบ → แสดงหน้า 1 (ไม่ 400, ไม่ NaN)", async () => {
    for (const bad of ["abc", "-5"]) {
      await page.goto(`${BACKEND_URL}/app/group-buying?gb_offset=${bad}`)
      await page.waitForURL((url) => !url.searchParams.has("gb_offset"))
      await expect(rows).toHaveCount(PAGE_SIZE)
      await expect(rows.filter({ hasText: name })).toHaveCount(1)
      await expect(page.getByTestId("gb-campaigns-table")).not.toContainText("NaN")
    }
  })
})

// ADM-10 (spec 08 AC-14, กฎ 13): gb_offset ผ่าน usePageOffset — ค่าว่างถูกลบ, ปัดลงเป็นต้นหน้า, เกินจำนวนแถว → หน้าสุดท้าย
test.describe("ADM-10: gb_offset ใน URL ที่ผิดรูป", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("AC-14: gb_offset ค่าว่าง / 25 / 99999 ถูก normalize/clamp", async ({ page, request, step }) => {
    test.setTimeout(180_000)
    const admin = await adminHeaders(request)
    const productId = await tshirtId(request, admin)
    const token = `ADM-10 ${Date.now()}`
    const { count } = await listCampaigns(request, admin, 0)
    for (let i = count; i <= PAGE_SIZE; i++) {
      await createCampaign(request, admin, productId, `${token} fill ${i}`)
    }
    const rows = page.getByTestId("gb-campaigns-table").locator("tbody tr")

    await step("?gb_offset= → ไม่มี gb_offset", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying?gb_offset=`)
      await page.waitForURL((url) => !url.searchParams.has("gb_offset"))
      await expect(rows).toHaveCount(PAGE_SIZE)
    })

    await step("?gb_offset=25 → gb_offset=20 (ต้นหน้า 2)", async () => {
      await page.goto(`${BACKEND_URL}/app/group-buying?gb_offset=25`)
      await page.waitForURL((url) => url.searchParams.get("gb_offset") === String(PAGE_SIZE))
      const second = await listCampaigns(request, admin, PAGE_SIZE)
      await expect(rows.filter({ hasText: second.campaigns[0].name })).toHaveCount(1)
    })

    await step("?gb_offset=99999 → gb_offset = ต้นหน้าสุดท้ายตาม count ขณะนั้น", async () => {
      const { count: total } = await listCampaigns(request, admin, 0)
      const last = Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE
      await page.goto(`${BACKEND_URL}/app/group-buying?gb_offset=99999`)
      await page.waitForURL((url) => url.searchParams.get("gb_offset") === String(last))
      await expect(rows.first()).toBeVisible()
      await expect(page.getByTestId("gb-campaigns-table")).not.toContainText("No group-buy campaigns yet")
    })
  })
})

// ADM-20 (spec 08 AC-24, กฎ 24): listCampaigns ล้ม → error ใน emptyState ของ DataTable (คงหัวตาราง + ปุ่ม Create campaign)
// ไม่ใช่ "No group-buy campaigns yet"; 401 → ErrorBoundary ของ dashboard พาไป /login
test.describe("ADM-20: สถานะ error ของรายการแคมเปญ", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-20" } })

  const CAMPAIGNS_ROUTE = "**/admin/group-buy/campaigns*"
  const EMPTY_TEXT = "No group-buy campaigns yet"

  async function expectErrorKeepsTable(page: Page) {
    const table = page.getByTestId("gb-campaigns-table")
    await expect(page.getByTestId("gb-campaigns-error")).toBeVisible()
    await expect(table.getByTestId("gb-campaigns-error")).toHaveCount(1)
    await expect(table).not.toContainText(EMPTY_TEXT)
    await expect(table).not.toContainText(PAGINATION_TEXT)
    await expect(page.getByTestId("gb-template-warning")).toBeVisible()
    // spec 08 กฎ 18: ปุ่มใน action ของ DataTable ไม่รับ data-testid → หาด้วย role + ชื่อภายใน wrapper
    const create = table.getByRole("button", { name: "Create campaign" })
    await expect(create).toBeEnabled()
    await create.click()
    await expect(page.getByTestId("gb-campaign-create-submit")).toBeVisible()
  }

  test("AC-24: ตอบ 500 → gb-campaigns-error แทน empty state, ปุ่ม Create campaign ยังเปิด modal ได้", async ({
    page,
    step,
    evidence,
  }) => {
    await loginAdmin(page)
    await page.route(CAMPAIGNS_ROUTE, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 500, json: { type: "unknown_error", message: "An unknown error occurred." } })
        : route.continue()
    )
    await step("เปิด /app/group-buying ขณะ API ตอบ 500", async () => {
      await page.goto(`${BACKEND_URL}/app/group-buying`)
      await expect(page.getByTestId("gb-campaigns-error")).toBeVisible()
      await evidence("01-list-error-500")
      await expectErrorKeepsTable(page)
    })
  })

  test("AC-24: network ล้ม (route.abort) → gb-campaigns-error และปุ่ม Create campaign ยังเปิด modal ได้", async ({
    page,
    step,
  }) => {
    await loginAdmin(page)
    await page.route(CAMPAIGNS_ROUTE, (route) =>
      route.request().method() === "GET" ? route.abort() : route.continue()
    )
    await step("เปิด /app/group-buying ขณะ network ล้ม", async () => {
      await page.goto(`${BACKEND_URL}/app/group-buying`)
      await expectErrorKeepsTable(page)
    })
  })

  test("AC-24: ตอบ 401 → ErrorBoundary พาไป /app/login", async ({ page }) => {
    await loginAdmin(page)
    await page.route(CAMPAIGNS_ROUTE, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 401, json: { type: "unauthorized", message: "Unauthorized" } })
        : route.continue()
    )
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    // จบ test ทันทีหลังถึงหน้า login (spec 08 AC-24)
    await page.waitForURL(/\/app\/login/)
  })

  test("AC-24: ตอบสำเร็จแต่ไม่มีแคมเปญ → empty state เดิม ไม่มี gb-campaigns-error", async ({ page, evidence }) => {
    await loginAdmin(page)
    await page.route(CAMPAIGNS_ROUTE, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, json: { campaigns: [], count: 0, offset: 0, limit: PAGE_SIZE } })
        : route.continue()
    )
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    await expect(page.getByTestId("gb-campaigns-table")).toContainText(EMPTY_TEXT)
    await expect(page.getByTestId("gb-campaigns-error")).toHaveCount(0)
    await evidence("02-list-empty")
  })
})

// ADM-21b (spec 08 AC-26, กฎ 25): GET groups / memberships ของหน้าแคมเปญล้มและไม่มีข้อมูลในมือ → error ใน emptyState ของ
// DataTable (คงหัวตาราง + gb-create-pool-group) แทน "No groups yet"/"No members yet"; 401 → ErrorBoundary พาไป /login;
// refetch ล้มขณะมีข้อมูล (กฎ 24d) → คงตารางเดิม
test.describe("ADM-21b: สถานะ error ของตาราง Groups / Members", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-21b" } })

  type Fail = (route: Route) => Promise<void>
  const fail500: Fail = (route) =>
    route.fulfill({ status: 500, json: { type: "unknown_error", message: "An unknown error occurred." } })
  const failAbort: Fail = (route) => route.abort()
  const fail401: Fail = (route) => route.fulfill({ status: 401, json: { type: "unauthorized", message: "Unauthorized" } })

  const GROUPS_ROUTE = "**/admin/group-buy/campaigns/*/groups*"
  const MEMBERSHIPS_ROUTE = "**/admin/group-buy/groups/*/memberships*"

  /** GET ที่ match → handle (POST ผ่านปกติ); นับจำนวน GET ที่ถูกจัดการ */
  async function onGet(page: Page, glob: string, handle: Fail) {
    const hits = { n: 0 }
    await page.route(glob, (route) => {
      if (route.request().method() !== "GET") return route.continue()
      hits.n++
      return handle(route)
    })
    return hits
  }

  /** แคมเปญ pool ที่ active (มีปุ่ม gb-create-pool-group) + pool group 1 กลุ่ม */
  async function activePoolCampaign(request: APIRequestContext) {
    const admin = await adminHeaders(request)
    const id = await createCampaign(request, admin, await tshirtId(request, admin), `ADM-21b ${Date.now()}`)
    const activate = await request.post(`${BASE}/campaigns/${id}/status`, { headers: admin, data: { status: "active" } })
    expect(activate.status(), `activate: ${await activate.text()}`).toBe(200)
    const group = await request.post(`${BASE}/campaigns/${id}/groups`, { headers: admin, data: { name: "Pool ADM-21b" } })
    expect(group.status(), `create pool group: ${await group.text()}`).toBe(201)
    return id
  }

  async function expectGroupsError(page: Page) {
    const table = page.getByTestId("gb-groups-table")
    await expect(page.getByTestId("gb-groups-error")).toBeVisible()
    await expect(table.getByTestId("gb-groups-error")).toContainText("Could not load groups")
    await expect(table).not.toContainText("No groups yet")
    await expect(table).not.toContainText(PAGINATION_TEXT)
    await expect(page.getByTestId("gb-create-pool-group")).toBeEnabled()
  }

  async function openMembers(page: Page, id: string) {
    await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
    await page.getByTestId("gb-groups-table").locator("tbody tr").first().click()
  }

  for (const [name, fail] of [
    ["ตอบ 500", fail500],
    ["network ล้ม (route.abort)", failAbort],
  ] as const) {
    test(`AC-26: GET groups ${name} → gb-groups-error แทน "No groups yet", gb-create-pool-group ยังอยู่`, async ({
      page,
      request,
      evidence,
    }) => {
      test.setTimeout(120_000)
      const id = await activePoolCampaign(request)
      await loginAdmin(page)
      await onGet(page, GROUPS_ROUTE, fail)
      await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
      await expectGroupsError(page)
      if (fail === fail500) await evidence("03-groups-error-500")
    })

    test(`AC-26: GET memberships ${name} หลังเลือกกลุ่ม → gb-memberships-error ไม่มี "No members yet"`, async ({
      page,
      request,
      evidence,
    }) => {
      test.setTimeout(120_000)
      const id = await activePoolCampaign(request)
      await loginAdmin(page)
      await onGet(page, MEMBERSHIPS_ROUTE, fail)
      await openMembers(page, id)
      const table = page.getByTestId("gb-memberships-table")
      await expect(page.getByTestId("gb-memberships-error")).toBeVisible()
      await expect(table.getByTestId("gb-memberships-error")).toContainText("Could not load members")
      await expect(table).not.toContainText("No members yet")
      await expect(table).not.toContainText(PAGINATION_TEXT)
      await expect(page.getByTestId("gb-memberships-close")).toBeEnabled()
      if (fail === fail500) await evidence("04-members-error-500")
    })
  }

  test("AC-26: GET groups ตอบ 401 → ErrorBoundary พาไป /app/login", async ({ page, request }) => {
    test.setTimeout(120_000)
    const id = await activePoolCampaign(request)
    await loginAdmin(page)
    await onGet(page, GROUPS_ROUTE, fail401)
    await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
    // จบ test ทันทีหลังถึงหน้า login (spec 08 AC-26)
    await page.waitForURL(/\/app\/login/)
  })

  test("AC-26: GET memberships ตอบ 401 → ErrorBoundary พาไป /app/login", async ({ page, request }) => {
    test.setTimeout(120_000)
    const id = await activePoolCampaign(request)
    await loginAdmin(page)
    await onGet(page, MEMBERSHIPS_ROUTE, fail401)
    await openMembers(page, id)
    await page.waitForURL(/\/app\/login/)
  })

  test("AC-26: groups / memberships ตอบรายการว่าง → empty state เดิม ไม่มี testid error", async ({ page, request }) => {
    test.setTimeout(120_000)
    const id = await activePoolCampaign(request)
    await loginAdmin(page)
    // กลุ่มใหม่ยังไม่มีสมาชิก → memberships ว่างจริงจาก API
    await openMembers(page, id)
    await expect(page.getByTestId("gb-memberships-table")).toContainText("No members yet")
    await expect(page.getByTestId("gb-memberships-error")).toHaveCount(0)
    await onGet(page, GROUPS_ROUTE, (route) =>
      route.fulfill({ status: 200, json: { groups: [], count: 0, offset: 0, limit: 20 } })
    )
    await page.reload()
    await expect(page.getByTestId("gb-groups-table")).toContainText("No groups yet")
    await expect(page.getByTestId("gb-groups-error")).toHaveCount(0)
  })

  // กฎ 24d (nit review #361): refetch เบื้องหลังล้มขณะมี data → คงแถวเดิม ไม่แสดง error
  test("กฎ 24d: Create pool group แล้ว refetch groups ล้ม → ตารางเดิมคงอยู่ ไม่มี gb-groups-error", async ({
    page,
    request,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const id = await activePoolCampaign(request)
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
    const rows = page.getByTestId("gb-groups-table").locator("tbody tr")
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText("Pool ADM-21b")

    const hits = await onGet(page, GROUPS_ROUTE, fail500)
    const post = page.waitForResponse((r) => r.request().method() === "POST" && /\/groups$/.test(r.url()))
    await page.getByTestId("gb-create-pool-group").click()
    expect((await post).status()).toBe(201)
    // invalidate → refetch ล้ม (retry 1 ของ QueryClient ของ dashboard = 2 request) แล้วรอ render หลัง error
    await expect.poll(() => hits.n, { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
    await page.waitForTimeout(1_000)
    await expect(page.getByTestId("gb-groups-error")).toHaveCount(0)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText("Pool ADM-21b")
    await expect(page.getByTestId("gb-groups-table")).not.toContainText("Could not load groups")
    await expect(page.getByTestId("gb-groups-table")).toContainText(PAGINATION_TEXT)
    await evidence("05-groups-refetch-fail-keeps-rows")
  })
})
