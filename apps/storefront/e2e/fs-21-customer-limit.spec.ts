import { APIResponse, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { chooseOption, selectOptions } from "./support/select"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// FS-21 (spec 03 กฎข้อ 26, AC-28): จำกัดจำนวนตามสิทธิ์ flash ต่อคนที่เหลือ + เตือนก่อนจ่าย (ลูกค้า login เจ้าของ cart)
// (a) limit 1 ยังไม่เคยซื้อ → PDP เลือกได้สูงสุด 1 + flash-customer-limit
// (b) ซื้อครบแล้ว → add-product-button disabled + flash-customer-limit-reached
// (c) cart มี line flash qty 2 → cart-flash-exceeds-customer-limit และขั้น review ปุ่ม submit-order-button disabled
//     ไม่มี POST /store/carts/*/complete; แก้จำนวนเป็น 1 → ปุ่มกดได้
// สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid เท่านั้น (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-21" } })
test.describe.configure({ mode: "serial" })

const THAI = /[฀-๿]/
const MANUAL = "pp_system_default"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let pk: string
let handle: string
let variantId: string
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

  handle = `e2e-fs21-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS21 ${run}`,
    handle,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS21-${run}`,
        options: { Size: "M" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: 1000 }],
      },
    ],
  })
  variantId = product.variants[0].id
  await post(
    `/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
    { location_id: stock_locations[0].id, stocked_quantity: 100 }
  )

  const { campaign } = await post("/admin/campaigns", {
    name: `FS-21 ${run}`,
    campaign_identifier: `fs21-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  await post("/admin/promotions", {
    code: `FS21-FLASH-${run}`,
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
  await post(`/admin/flash-sales/${campaignId}/config`, { per_customer_limit: 1, show_remaining: false })
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

/** ขั้น payment → เลือก manual → ขั้น review (ปุ่ม submit-order-button แสดง) */
async function toReview(page: Page) {
  await page.goto(`/${CC}/checkout?step=payment`)
  await page.getByTestId(`payment-option-${MANUAL}`).click()
  const submit = page.getByTestId("submit-payment-button")
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page).toHaveURL(/step=review/)
  await expect(page.getByTestId("submit-order-button")).toBeVisible()
}

test("AC-28 (a): limit 1 ยังไม่เคยซื้อ → PDP เลือกจำนวนได้สูงสุด 1 และเห็น flash-customer-limit", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  await step("PDP: ตัวเลือกจำนวนมีแค่ 1 + ข้อความจำกัดต่อคนภาษาไทย + ปุ่มกดได้", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    const limit = page.getByTestId("flash-customer-limit")
    await expect(limit).toBeVisible()
    await expect(limit).toHaveText(THAI)
    await expect(limit).toContainText("1")
    expect((await selectOptions(page.getByTestId("product-quantity-select"))).options).toHaveLength(1)
    await expect(page.getByTestId("flash-customer-limit-reached")).toHaveCount(0)
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("01-pdp-customer-limit")
  })
})

test("AC-28 (b): ซื้อครบสิทธิ์แล้ว → add-product-button disabled + flash-customer-limit-reached", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await placeOrder(request, pk, customer, { variant: variantId, quantity: 1 })
  await signInAs(context, baseURL!, customer)

  await step("PDP: ข้อความใช้สิทธิ์ครบภาษาไทย และปุ่มเพิ่มลงตะกร้า disabled", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    const reached = page.getByTestId("flash-customer-limit-reached")
    await expect(reached).toBeVisible()
    await expect(reached).toHaveText(THAI)
    await expect(page.getByTestId("flash-customer-limit")).toContainText("0")
    await expect(page.getByTestId("add-product-button")).toBeDisabled()
    await evidence("02-pdp-customer-limit-reached")
  })
})

test("AC-28 (c): cart มี line flash qty 2 ขณะ limit 1 → เตือนใน cart และ review ไม่ให้สั่งซื้อจนแก้จำนวน", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 2 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  const completes: string[] = []
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/store\/carts\/[^/]+\/complete/.test(r.url())) completes.push(r.url())
  })

  await step("/th/cart: line มี cart-flash-exceeds-customer-limit ภาษาไทยบอกจำนวนที่ซื้อได้", async () => {
    await page.goto(`/${CC}/cart`)
    const warning = page.getByTestId("product-row").getByTestId("cart-flash-exceeds-customer-limit")
    await expect(warning).toBeVisible()
    await expect(warning).toHaveText(THAI)
    await expect(warning).toContainText("1")
    await evidence("03-cart-exceeds-customer-limit")
  })

  await step("ขั้น review: submit-order-button disabled และไม่มี request complete", async () => {
    await toReview(page)
    await expect(page.getByTestId("review-flash-exceeds-customer-limit")).toHaveText(THAI)
    await expect(page.getByTestId("submit-order-button")).toBeDisabled()
    await evidence("04-review-submit-disabled")
    expect(completes).toEqual([])
  })

  await step("แก้จำนวนเป็น 1 ในตะกร้า → คำเตือนหาย และขั้น review ปุ่มกดได้", async () => {
    await page.goto(`/${CC}/cart`)
    await chooseOption(page.getByTestId("product-select-button"), "1")
    await expect(page.getByTestId("cart-flash-exceeds-customer-limit")).toHaveCount(0)
    await toReview(page)
    await expect(page.getByTestId("review-flash-exceeds-customer-limit")).toHaveCount(0)
    await expect(page.getByTestId("submit-order-button")).toBeEnabled()
    expect(completes).toEqual([])
  })
})
