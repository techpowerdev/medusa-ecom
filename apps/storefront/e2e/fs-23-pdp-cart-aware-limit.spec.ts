import { APIResponse } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// FS-23 (spec 03 กฎข้อ 28, AC-30 b/c): PDP หักจำนวนในตะกร้าก่อนแสดงสิทธิ์ที่เหลือ + คนไม่ login เห็นจำกัดต่อคน
// (b) ไม่ login: แคมเปญ limit 2 → flash-customer-limit มีเลข 2 และอักษรไทย (ไม่มีส่วนสิทธิ์ที่เหลือ/ข้อความครบสิทธิ์)
// (c) login limit 2 ไม่เคยซื้อ: ตะกร้ามี 1 ชิ้น (อีก variant ในแคมเปญเดียวกัน) → PDP เลือกได้สูงสุด 1;
//     เพิ่มอีก 1 ชิ้นจาก PDP (ตะกร้ามี 2) → add-product-button disabled + flash-customer-limit-reached (ทั้งทันทีและหลังโหลดหน้าใหม่)
// สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid เท่านั้น (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-23" } })
test.describe.configure({ mode: "serial" })

const THAI = /[\u0E00-\u0E7F]/

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let pk: string
let handle: string
let variantM: string
let variantL: string
let campaignId: string

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

  handle = `e2e-fs23-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS23 ${run}`,
    handle,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M", "L"] }],
    variants: ["M", "L"].map((size) => ({
      title: size,
      sku: `FS23-${size}-${run}`,
      options: { Size: size },
      manage_inventory: true,
      prices: [{ currency_code: "thb", amount: 1000 }],
    })),
  })
  for (const v of product.variants) {
    await post(`/admin/inventory-items/${v.inventory_items[0].inventory_item_id}/location-levels`, {
      location_id: stock_locations[0].id,
      stocked_quantity: 100,
    })
  }
  // FS-25 (กฎข้อ 30b): ลำดับ variants ไม่คงที่ → PDP เปิดด้วย `?v_id=` ของ M เสมอ (ไม่สมมติว่า variant แรกถูกเลือก)
  const idOf = (title: string) => product.variants.find((v: { title: string }) => v.title === title).id
  variantM = idOf("M")
  variantL = idOf("L")

  const { campaign } = await post("/admin/campaigns", {
    name: `FS-23 ${run}`,
    campaign_identifier: `fs23-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  await post("/admin/promotions", {
    code: `FS23-FLASH-${run}`,
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
  await post(`/admin/flash-sales/${campaignId}/config`, { per_customer_limit: 2, show_remaining: false })
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

test("AC-30 (b): ไม่ login → PDP เห็น flash-customer-limit มีเลข 2 และอักษรไทย", async ({ page, step, evidence }) => {
  await step("PDP: จำกัด 2 ชิ้นต่อคน ไม่มีข้อความครบสิทธิ์ และปุ่มเพิ่มลงตะกร้ากดได้", async () => {
    await page.goto(`/${CC}/products/${handle}?v_id=${variantM}`)
    const limit = page.getByTestId("flash-customer-limit")
    await expect(limit).toBeVisible()
    await expect(limit).toHaveText(THAI)
    await expect(limit).toContainText("2")
    await expect(page.getByTestId("flash-customer-limit-reached")).toHaveCount(0)
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("01-pdp-guest-customer-limit")
  })
})

test("AC-30 (c): login limit 2 มีของในตะกร้า 1 ชิ้น → PDP เลือกได้สูงสุด 1; ตะกร้ามี 2 → ปุ่ม disabled + flash-customer-limit-reached", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  // variant L อยู่ในแคมเปญเดียวกับ M (variant ที่ PDP เลือกผ่าน `?v_id=`) → นับรวมสิทธิ์ของแคมเปญ
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantL, quantity: 1 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await step("PDP: ตัวเลือกจำนวนมีแค่ 1 และสิทธิ์ที่เหลือหักของในตะกร้าแล้ว", async () => {
    await page.goto(`/${CC}/products/${handle}?v_id=${variantM}`)
    const limit = page.getByTestId("flash-customer-limit")
    await expect(limit).toHaveText(THAI)
    await expect(limit).toContainText("2")
    await expect(limit).toContainText("1")
    await expect(page.getByTestId("product-quantity-select").locator("option")).toHaveCount(1)
    await expect(page.getByTestId("flash-customer-limit-reached")).toHaveCount(0)
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("02-pdp-limit-minus-cart")
  })

  await step("เพิ่มอีก 1 ชิ้น (ตะกร้ามี 2) → ปุ่ม disabled + flash-customer-limit-reached ภาษาไทย", async () => {
    await page.getByTestId("add-product-button").click()
    const reached = page.getByTestId("flash-customer-limit-reached")
    await expect(reached).toBeVisible()
    await expect(reached).toHaveText(THAI)
    await expect(page.getByTestId("flash-customer-limit")).toContainText("0")
    await expect(page.getByTestId("add-product-button")).toBeDisabled()
    await evidence("03-pdp-limit-in-cart")
  })

  await step("โหลดหน้าใหม่ → ยังคง disabled + flash-customer-limit-reached", async () => {
    await page.reload()
    await expect(page.getByTestId("flash-customer-limit-reached")).toBeVisible()
    await expect(page.getByTestId("add-product-button")).toBeDisabled()
  })
})
