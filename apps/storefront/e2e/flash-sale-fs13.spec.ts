import { APIResponse, APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
} from "./support/medusa"

// FS-13 (spec 03 กฎข้อ 18, AC-19): ราคา flash บนการ์ด PLP (หน้า collection) และแถบล่างของ PDP บนมือถือ (375×812);
// แคมเปญ sold out → ปุ่ม add-product-button disabled + flash-sold-out
// สร้างสินค้า/collection/แคมเปญเฉพาะของ test นี้ (target rule เฉพาะสินค้านี้) และปิดแคมเปญเมื่อจบ
// หา element ด้วย data-testid เท่านั้น (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-13" } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000

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

async function setConfig(request: APIRequestContext, data: object) {
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, { headers: admin, data }),
    "flash sale config"
  )
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

  collectionHandle = `e2e-fs13-${run}`
  const { collection } = await post("/admin/collections", { title: `FS-13 ${run}`, handle: collectionHandle })

  handle = `e2e-fs13-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS13 ${run}`,
    handle,
    status: "published",
    collection_id: collection.id,
    // รูป (รูปเดียวกับ seed) ดันปุ่มบน PDP มือถือลงใต้ขอบจอ แถบล่างจึงแสดงค้างไว้ (ไม่มีรูป = ปุ่มอยู่ในจอ แถบล่างซ่อน)
    images: [{ url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png" }],
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS13-${run}`,
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
    name: `FS-13 ${run}`,
    campaign_identifier: `fs13-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  // automatic −20% (Promotion module ของ Medusa คำนวณ ฿800); FS-5 ใส่ exclusivity rule ให้ตอนบันทึก config
  await post("/admin/promotions", {
    code: `FS13-FLASH-${run}`,
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
  await setConfig(request, { total_cap: 1, show_countdown: true, show_remaining: true })
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

test("AC-19: การ์ดสินค้าบน PLP (desktop) แสดงราคา flash + ราคาขีดฆ่า", async ({ page, step, evidence }) => {
  await step("หน้า collection: การ์ดของสินค้าในแคมเปญแสดง ฿800 และ ฿1,000 ขีดฆ่า", async () => {
    await page.goto(`/${CC}/collections/${collectionHandle}`)
    const card = page.getByTestId("product-wrapper")
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("flash-price")).toHaveText("฿800")
    await expect(card.getByTestId("flash-original-price")).toHaveText("฿1,000")
    await expect(card.getByTestId("flash-original-price")).toHaveCSS("text-decoration-line", "line-through")
    await evidence("01-plp-card-flash-price")
  })
})

test("AC-19: PDP ที่ 375×812 แถบล่างแสดงราคา flash", async ({ page, step, evidence }) => {
  await page.setViewportSize({ width: 375, height: 812 })

  await step("แถบล่าง (mobile-actions) แสดง ฿800 และ ฿1,000 ขีดฆ่า ปุ่มยังกดได้", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("add-product-button")).not.toBeInViewport()
    const bar = page.getByTestId("mobile-actions")
    await expect(bar).toBeVisible()
    await expect(bar.getByTestId("flash-price")).toHaveText("฿800")
    await expect(bar.getByTestId("flash-original-price")).toHaveText("฿1,000")
    await expect(bar.getByTestId("flash-original-price")).toHaveCSS("text-decoration-line", "line-through")
    await expect(page.getByTestId("mobile-cart-button")).toBeEnabled()
    await evidence("02-pdp-mobile-bar-flash-price")
  })
})

test("AC-19: แคมเปญ sold out → add-product-button disabled และเห็น flash-sold-out", async ({
  page,
  request,
  step,
}) => {
  await step("complete order flash 1 ชิ้นใต้ total_cap=1 (units_sold = 1 → sold_out)", async () => {
    await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId })
  })

  await step("PDP: flash-sold-out มองเห็นได้ ปุ่มเพิ่มลงตะกร้า disabled และไม่มีราคา flash", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("flash-sold-out")).toBeVisible()
    await expect(page.getByTestId("add-product-button")).toBeDisabled()
    await expect(page.getByTestId("product-availability")).toHaveText("สินค้าหมด")
    await expect(page.getByTestId("flash-price")).toHaveCount(0)
  })

  await step("PLP: การ์ดกลับไปแสดงราคาปกติ", async () => {
    await page.goto(`/${CC}/collections/${collectionHandle}`)
    const card = page.getByTestId("product-wrapper")
    await expect(card.getByTestId("price")).toHaveText("฿1,000")
    await expect(card.getByTestId("flash-price")).toHaveCount(0)
  })
})
