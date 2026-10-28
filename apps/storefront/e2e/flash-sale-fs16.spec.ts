import { APIResponse, Page, Route } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
} from "./support/medusa"

// FS-16 (spec 03 กฎข้อ 21, AC-23): (a) ปุ่มเพิ่มลงตะกร้ารอ (disabled + aria-busy) จนข้อมูล flash ตอบ — error แล้วกลับมากดได้
// (b) product-price ขีดฆ่าเมื่อ variant มีราคา flash (c) การ์ดบน collection ของสินค้าที่แคมเปญ sold out มีป้าย flash-card-sold-out
// สร้างสินค้า/collection/แคมเปญเฉพาะของ test นี้ (target rule เฉพาะสินค้านี้) และปิดแคมเปญเมื่อจบ — หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-16" } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000
const THAI = /[฀-๿]/

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let pk: string
let handle: string
let collectionHandle: string
let variantId: string
let campaignId: string

/**
 * ข้อมูล flash บน PDP ดึงผ่าน server action (`getActiveFlashSales`) — mock เฉพาะ POST ที่มี header next-action
 * และ body มี variant id ของสินค้านี้ (server action อื่นของหน้าไม่ถูกแตะ)
 */
async function mockFlashAction(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route(`**/products/${handle}**`, async (route) => {
    const req = route.request()
    if (req.method() === "POST" && req.headers()["next-action"] && (req.postData() ?? "").includes(variantId)) {
      return handler(route)
    }
    return route.fallback()
  })
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }), path)
  const run = `${Date.now()}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")

  collectionHandle = `e2e-fs16-${run}`
  const { collection } = await post("/admin/collections", { title: `FS-16 ${run}`, handle: collectionHandle })

  handle = `e2e-fs16-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS16 ${run}`,
    handle,
    status: "published",
    collection_id: collection.id,
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS16-${run}`,
        options: { Size: "M" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: PRICE }],
      },
    ],
  })
  variantId = product.variants[0].id
  await post(
    `/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
    { location_id: stock_locations[0].id, stocked_quantity: 100 }
  )

  const { campaign } = await post("/admin/campaigns", {
    name: `FS-16 ${run}`,
    campaign_identifier: `fs16-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  // automatic −20% (Promotion module ของ Medusa คำนวณ ฿800); FS-5 ใส่ exclusivity rule ให้ตอนบันทึก config
  await post("/admin/promotions", {
    code: `FS16-FLASH-${run}`,
    type: "standard",
    status: "active",
    is_automatic: true,
    campaign_id: campaignId,
    application_method: {
      type: "percentage",
      target_type: "items",
      allocation: "across",
      value: 20,
      target_rules: [{ attribute: "items.product.id", operator: "in", values: [product.id] }],
    },
  })
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, {
      headers: admin,
      data: { total_cap: 1, show_countdown: true, show_remaining: true },
    }),
    "flash sale config"
  )
})

test.afterAll(async ({ request }) => {
  if (campaignId) {
    await ok(
      await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
        headers: admin,
        data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
      }),
      "end campaign"
    )
  }
})

test("AC-23: แคมเปญไม่ sold out → product-price ขีดฆ่า (text-decoration-line: line-through)", async ({
  page,
  step,
  evidence,
}) => {
  await step("PDP: เห็นราคา flash ฿800 และ product-price ฿1,000 ขีดฆ่า", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("flash-sale").getByTestId("flash-price")).toHaveText("฿800")
    await expect(page.getByTestId("product-price")).toHaveText("฿1,000")
    await expect(page.getByTestId("product-price")).toHaveCSS("text-decoration-line", "line-through")
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("01-pdp-product-price-struck")
  })
})

test("AC-23: route ของ flash ตอบ 500 → ปุ่มกลับมากดได้ภายใน 5 วินาที", async ({ page, step }) => {
  let served = false
  await mockFlashAction(page, async (route) => {
    await new Promise((r) => setTimeout(r, 1_000))
    await route.fulfill({ status: 500, body: "boom" })
    served = true
  })

  await step("PDP: ระหว่างรอปุ่มอยู่ในสถานะรอ หลัง 500 ปุ่มกดได้ภายใน 5 วินาที (ไม่ค้าง) และไม่มีกล่อง flash", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    const button = page.getByTestId("add-product-button")
    await expect(button).toHaveAttribute("aria-busy", "true")
    await expect.poll(() => served, { timeout: 5_000 }).toBe(true)
    await expect(button).toBeEnabled({ timeout: 5_000 })
    await expect(button).not.toHaveAttribute("aria-busy", "true")
    await expect(page.getByTestId("flash-sale")).toHaveCount(0)
    await expect(page.getByTestId("product-price")).not.toHaveCSS("text-decoration-line", "line-through")
  })
})

test("AC-23: แคมเปญ sold out + route ของ flash หน่วง 3 วินาที → ปุ่มรอ แล้ว disabled ด้วยเหตุ sold out", async ({
  page,
  request,
  step,
  evidence,
}) => {
  await step("complete order flash 1 ชิ้นใต้ total_cap=1 (units_sold = 1 → sold_out)", async () => {
    await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId })
  })

  let answered = false
  await mockFlashAction(page, async (route) => {
    await new Promise((r) => setTimeout(r, 3_000))
    await route.continue()
    answered = true
  })

  await step("ระหว่างรอ: add-product-button มี aria-busy=true และ disabled", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    const button = page.getByTestId("add-product-button")
    await expect(button).toHaveAttribute("aria-busy", "true")
    await expect(button).toBeDisabled()
    expect(answered, "ต้องตรวจขณะ request flash ยังไม่ตอบ").toBe(false)
  })

  await step("หลังตอบ: flash-sold-out แสดง ปุ่มยัง disabled และไม่อยู่ในสถานะรอแล้ว", async () => {
    await expect(page.getByTestId("flash-sold-out")).toBeVisible({ timeout: 10_000 })
    const button = page.getByTestId("add-product-button")
    await expect(button).not.toHaveAttribute("aria-busy", "true")
    await expect(button).toBeDisabled()
    await expect(page.getByTestId("product-price")).not.toHaveCSS("text-decoration-line", "line-through")
  })

  await step("collection: การ์ดของสินค้ามีป้าย flash-card-sold-out (อักษรไทย) และราคาปกติ", async () => {
    await page.goto(`/${CC}/collections/${collectionHandle}`)
    const card = page.getByTestId("product-wrapper")
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("flash-card-sold-out")).toHaveText(THAI)
    await expect(card.getByTestId("price")).toHaveText("฿1,000")
    await expect(card.getByTestId("flash-price")).toHaveCount(0)
    await evidence("02-collection-card-sold-out")
  })
})
