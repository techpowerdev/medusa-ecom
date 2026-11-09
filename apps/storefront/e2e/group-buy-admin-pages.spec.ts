import { APIRequestContext } from "@playwright/test"

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
