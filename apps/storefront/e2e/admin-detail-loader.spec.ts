import { APIRequestContext, Page, Request, Route } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call, createVoucher } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// ADM-11 (spec 08 AC-15, กฎ 14): หน้ารายละเอียด pool / group buy ใช้ผลของ loader เป็น `initialData` ของ `useQuery`
// → เปิดตรงไม่ยิง GET resource ซ้ำ และคลิกจากรายการไม่รอ GET สองรอบต่อกัน; breadcrumb หน้า pool = "E-vouchers › <ชื่อ pool>"
// expect.soft ที่ตัวเลข/breadcrumb: รายงานทุกข้อที่ล้มในรอบเดียว (หลักฐานก่อน/หลังแก้)
// admin UI เป็นภาษาอังกฤษ — หา element ด้วย data-testid ยกเว้น breadcrumb ของ dashboard (ไม่มี testid; อ่านแบบ AC-9)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-11" },
})

const HOUR = 60 * 60 * 1000
const MAX_GETS = 2
const DELAY_MS = 2000

async function createCampaign(request: APIRequestContext, admin: Headers, name: string): Promise<string> {
  // GB-6e (spec 04 กฎข้อ 30): 1 แคมเปญ = 1 สินค้า — ใช้สินค้า seed `t-shirt` ด้วย handle (CORE-46 กฎข้อ 104d)
  const { products } = await call(request, admin, "/admin/products?handle=t-shirt&fields=id")
  expect(products, "สินค้า seed t-shirt").toHaveLength(1)
  const { campaign } = await call(request, admin, "/admin/group-buy/campaigns", {
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
      target_rules: [{ attribute: "items.product.id", operator: "in", values: [products[0].id] }],
    },
  })
  return campaign.id
}

/** นับ GET ที่ pathname ตรง `pathname` พอดี (ไม่นับ sub-resource เช่น `/groups`, `/codes`) */
function countGets(page: Page, pathname: string) {
  const seen: string[] = []
  const onRequest = (req: Request) => {
    if (req.method() === "GET" && new URL(req.url()).pathname === pathname) seen.push(req.url())
  }
  page.on("request", onRequest)
  return {
    count: () => seen.length,
    stop: () => page.off("request", onRequest),
  }
}

test("AC-15: หน้ารายละเอียดใช้ผลของ loader (ไม่ GET ซ้ำ), คลิกจากรายการเร็วขึ้น และ breadcrumb E-vouchers", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const name = `ADM-11 ${Date.now()}`
  const campaignId = await createCampaign(request, admin, name)
  const { variantId } = await createVoucher(request, admin, 1)
  const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
  const poolId: string = pools[0].id
  const poolName: string = pools[0].name

  const campaignPath = `/admin/group-buy/campaigns/${campaignId}`
  const poolPath = `/admin/evoucher/pools/${poolId}`

  await step(`เปิด /group-buying/:id ตรง → GET ${campaignPath} ≤ ${MAX_GETS}`, async () => {
    await loginAdmin(page)
    const gets = countGets(page, campaignPath)
    await page.goto(`${BACKEND_URL}/app/group-buying/${campaignId}`)
    await expect(page.getByTestId("gb-campaign-status")).toBeVisible({ timeout: 30_000 })
    await page.waitForLoadState("networkidle")
    gets.stop()
    console.log(`ADM-11 GET ${campaignPath}: ${gets.count()}`)
    expect.soft(gets.count(), "จำนวน GET แคมเปญ").toBeLessThanOrEqual(MAX_GETS)
  })

  await step(`เปิด /evouchers/pools/:id ตรง → GET ${poolPath} ≤ ${MAX_GETS} และ breadcrumb E-vouchers › ชื่อ pool`, async () => {
    const gets = countGets(page, poolPath)
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${poolId}`)
    await expect(page.getByTestId("evoucher-codes")).toBeVisible({ timeout: 30_000 })
    await page.waitForLoadState("networkidle")
    gets.stop()
    console.log(`ADM-11 GET ${poolPath}: ${gets.count()}`)
    expect.soft(gets.count(), "จำนวน GET pool").toBeLessThanOrEqual(MAX_GETS)

    const breadcrumb = page.locator("ol").first().locator("li")
    await expect.soft(breadcrumb).toHaveCount(2)
    await expect.soft(breadcrumb.first()).toHaveText("E-vouchers")
    await expect.soft(breadcrumb.first().locator("a")).toHaveAttribute("href", "/app/evouchers")
    // li สุดท้ายมี "..." (lg:hidden) + label → ดูเฉพาะ span ที่มองเห็น (แบบ e2e group-buy-admin-pages)
    await expect(breadcrumb.last().locator("span:visible")).toHaveText(poolName)
    await evidence("01-pool-breadcrumb")
  })

  await step(`หน่วง GET แคมเปญ ${DELAY_MS}ms แล้วคลิกแถวในรายการ → gb-campaign-status ภายใน 3500ms`, async () => {
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    const row = page.getByTestId("gb-campaigns-table").locator("tbody tr").filter({ hasText: name })
    await expect(row).toHaveCount(1)
    const isCampaign = (url: URL) => url.pathname === campaignPath
    const slow = async (route: Route) => {
      if (route.request().method() === "GET") await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
      await route.continue()
    }
    await page.route(isCampaign, slow)
    const started = Date.now()
    await row.click()
    await expect(page.getByTestId("gb-campaign-status")).toBeVisible({ timeout: 15_000 })
    const elapsed = Date.now() - started
    await page.unroute(isCampaign, slow)
    console.log(`ADM-11 click → gb-campaign-status: ${elapsed}ms`)
    expect.soft(elapsed, "เวลาจากคลิกถึงเห็นสถานะ (ms)").toBeLessThan(3500)
    await evidence("02-campaign-detail")
  })

  await step("id ที่ไม่มี → gb-campaign-not-found (AC-9)", async () => {
    await page.goto(`${BACKEND_URL}/app/group-buying/gbc_adm11_missing`)
    await expect(page.getByTestId("gb-campaign-not-found")).toBeVisible({ timeout: 30_000 })
  })
})
