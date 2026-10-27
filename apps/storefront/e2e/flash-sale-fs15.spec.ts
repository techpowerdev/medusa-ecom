import { APIResponse, APIRequestContext } from "@playwright/test"

import { CHECKOUT_CONFLICTS } from "../src/lib/util/checkout-error"
import { BACKEND_URL, expect, test } from "./support/fixtures"
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

// FS-15 (spec 03 กฎข้อ 20, AC-21, AC-22): จำนวนที่เกินโควตา flash
// - PDP: เลือกจำนวน > remaining_units → flash-qty-exceeds-remaining + add-product-button disabled
// - cart: line ที่ได้ราคา flash และจำนวน > remaining_units → cart-flash-exceeds-remaining
// - review: complete ล้ม 409 FLASH_SOLD_OUT → ข้อความไทยเฉพาะของ code (ไม่ใช่ข้อความอังกฤษของ backend)
// สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid เท่านั้น (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-15" } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000
const THAI = /[฀-๿]/
const MANUAL = "pp_system_default"
const text = (code: string) => CHECKOUT_CONFLICTS.find((c) => c.code === code)!

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

  handle = `e2e-fs15-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS15 ${run}`,
    handle,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS15-${run}`,
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
    name: `FS-15 ${run}`,
    campaign_identifier: `fs15-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  await post("/admin/promotions", {
    code: `FS15-FLASH-${run}`,
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
  await setConfig(request, { total_cap: 3, show_countdown: true, show_remaining: true })
  // units_sold = 1 → remaining_units = 2
  await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId })
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

test("AC-21: PDP เลือกจำนวน 3 ขณะ remaining_units=2 → เตือน + ปุ่ม disabled; เลือก 2 → กดได้", async ({
  page,
  step,
  evidence,
}) => {
  await page.goto(`/${CC}/products/${handle}`)
  await expect(page.getByTestId("flash-remaining")).toContainText("2")
  const select = page.getByTestId("product-quantity-select")
  const button = page.getByTestId("add-product-button")

  await step("เลือก 3 → flash-qty-exceeds-remaining มีอักษรไทย และ add-product-button disabled", async () => {
    await select.selectOption("3")
    const warning = page.getByTestId("flash-qty-exceeds-remaining")
    await expect(warning).toBeVisible()
    await expect(warning).toHaveText(THAI)
    await expect(warning).toContainText("2")
    await expect(button).toBeDisabled()
    await evidence("01-pdp-qty-exceeds-remaining")
  })

  await step("เลือก 2 → ไม่มีคำเตือน และปุ่มกดได้", async () => {
    await select.selectOption("2")
    await expect(page.getByTestId("flash-qty-exceeds-remaining")).toHaveCount(0)
    await expect(button).toBeEnabled()
  })
})

test("AC-21: show_remaining=false (remaining_units=null) เลือก 3 → ไม่เตือน", async ({ page, request, step }) => {
  await setConfig(request, { total_cap: 3, show_countdown: true, show_remaining: false })
  try {
    await step("PDP เลือก 3 → ไม่มี flash-qty-exceeds-remaining และปุ่มกดได้", async () => {
      await page.goto(`/${CC}/products/${handle}`)
      await expect(page.getByTestId("flash-price")).toBeVisible()
      await expect(page.getByTestId("flash-remaining")).toHaveCount(0)
      await page.getByTestId("product-quantity-select").selectOption("3")
      await expect(page.getByTestId("add-product-button")).toBeEnabled()
      await expect(page.getByTestId("flash-qty-exceeds-remaining")).toHaveCount(0)
    })
  } finally {
    await setConfig(request, { total_cap: 3, show_countdown: true, show_remaining: true })
  }
})

test("AC-21: cart มี line ของสินค้า flash qty 3 ขณะ remaining_units=2 → cart-flash-exceeds-remaining", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 3 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await step("/th/cart: line นั้นมีคำเตือนภาษาไทย และยังแก้จำนวนได้", async () => {
    await page.goto(`/${CC}/cart`)
    const row = page.getByTestId("product-row")
    await expect(row).toHaveCount(1)
    const warning = row.getByTestId("cart-flash-exceeds-remaining")
    await expect(warning).toBeVisible()
    await expect(warning).toHaveText(THAI)
    await expect(row.getByTestId("product-select-button")).toBeEnabled()
    await evidence("02-cart-flash-exceeds-remaining")
  })

  await step("ลดจำนวนเป็น 2 → คำเตือนหายไป", async () => {
    await page.getByTestId("product-select-button").selectOption("2")
    await expect(page.getByTestId("cart-flash-exceeds-remaining")).toHaveCount(0)
  })
})

test("AC-22: complete ล้ม 409 FLASH_SOLD_OUT ระหว่าง checkout → ข้อความไทยของ code ในขั้น review", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await step("ไปขั้น review ด้วย manual payment", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    const submit = page.getByTestId("submit-payment-button")
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page.getByTestId("submit-order-button")).toBeVisible({ timeout: 15_000 })
  })

  await step("ลูกค้าอื่นซื้อ 2 ชิ้นที่เหลือ → units_sold = total_cap", async () => {
    await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId, quantity: 2 })
  })

  await step("กดสั่งซื้อ → error ภาษาไทยของ FLASH_SOLD_OUT ไม่มีข้อความอังกฤษของ backend", async () => {
    await page.getByTestId("submit-order-button").click()
    const error = page.getByTestId("manual-payment-error-message")
    await expect(error).toBeVisible({ timeout: 15_000 })
    await expect(error).toHaveText(text("FLASH_SOLD_OUT").text)
    await expect(error).toHaveText(THAI)
    await expect(error).not.toContainText(text("FLASH_SOLD_OUT").message)
    await expect(error).not.toHaveText(text("FLASH_LIMIT_EXCEEDED").text)
    await expect(page).toHaveURL(/\/checkout/)
    await evidence("03-review-flash-sold-out")
  })
})
