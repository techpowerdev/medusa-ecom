import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// EV-7c (spec 02 กฎข้อ 24, AC-3 ส่วน storefront, AC-37): checkout ของ cart ที่มีแต่ e-voucher
// ไม่มีขั้น delivery, ขั้นที่อยู่เป็นที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษี (ไม่มีคำว่า "จัดส่ง"), manual payment (CI)
// ส่วน tax_total = total × 7/107 ด้วย MathBN อยู่ใน integration (apps/backend/integration-tests/http/evoucher-digital-checkout.spec.ts)
test.use({ evidenceTarget: { feature: "evoucher", taskId: "EV-7c" } })

const MANUAL = "pp_system_default"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(
  request: APIRequestContext,
  headers: Headers,
  path: string,
  data?: Record<string, unknown>
): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** voucher product (ไม่มี shipping profile) + pool + import 2 code → line requires_shipping=false (กฎข้อ 1) */
async function createVoucher(request: APIRequestContext, admin: Headers): Promise<string> {
  const tag = `ev7c-${Date.now()}`
  const { sales_channels } = await call(request, admin, "/admin/sales-channels?name=Default%20Sales%20Channel")
  const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
  const { product } = await call(request, admin, "/admin/products", {
    title: `EV-7c voucher ${tag}`,
    handle: tag,
    status: "published",
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Value", values: ["500"] }],
    variants: [
      {
        title: "500 THB",
        options: { Value: "500" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: 500 }],
      },
    ],
  })
  const variantId: string = product.variants[0].id
  const { variant } = await call(
    request,
    admin,
    `/admin/products/${product.id}/variants/${variantId}?fields=inventory_items.inventory_item_id`
  )
  await call(request, admin, `/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`, {
    location_id: stock_locations[0].id,
    stocked_quantity: 0,
  })
  const { partner } = await call(request, admin, "/admin/evoucher/partners", { name: `Partner ${tag}` })
  const { pool } = await call(request, admin, "/admin/evoucher/pools", {
    partner_id: partner.id,
    variant_id: variantId,
    name: `Pool ${tag}`,
    how_to_use: "แสดง code ที่แคชเชียร์",
  })
  const imported = await request.post(`${BACKEND_URL}/admin/evoucher/pools/${pool.id}/import`, {
    headers: admin,
    multipart: {
      file: { name: "codes.csv", mimeType: "text/csv", buffer: Buffer.from(`${tag}-A,1111\n${tag}-B,2222\n`) },
    },
  })
  expect(imported.status(), "import codes").toBe(200)
  return tag
}

const BILLING = { address_1: "99 ถนนสุขุมวิท", postal_code: "10110", country_code: CC }

test("AC-37, AC-3: cart มีแต่ voucher → ไม่มีขั้น delivery, ที่อยู่ใบกำกับภาษีเป็น shipping_address, order สำเร็จ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const handle = await createVoucher(request, admin)

  await step("ใส่ voucher ลงตะกร้าแล้วไปชำระเงิน", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(1)
    await page.getByTestId("checkout-button").click()
    await expect(page).toHaveURL(/step=address/)
  })

  await step("ขั้นที่อยู่: ฟอร์มที่อยู่ใบเสร็จ/ใบกำกับภาษี ไม่มีคำว่าจัดส่ง และไม่มีขั้น delivery", async () => {
    await expect(page.getByTestId("billing-first-name-input")).toBeVisible()
    await expect(page.getByTestId("shipping-first-name-input")).toHaveCount(0)
    await expect(page.getByTestId("addresses-section")).not.toContainText("จัดส่ง")
    await expectThai(page, ["addresses-heading", "submit-address-button"])
    await expect(page.getByTestId("delivery-heading")).toHaveCount(0)
    await evidence("01-billing-address-form")

    await page.getByTestId("billing-first-name-input").fill("สมชาย")
    await page.getByTestId("billing-last-name-input").fill("ใจดี")
    await page.getByTestId("billing-address-input").fill(BILLING.address_1)
    await page.getByTestId("billing-postal-input").fill(BILLING.postal_code)
    await page.getByTestId("billing-country-select").selectOption(BILLING.country_code)
    await page.getByTestId("billing-email-input").fill(customer.email)
    await page.getByTestId("submit-address-button").click()
  })

  await step("ข้ามไปขั้นชำระเงินทันที (manual payment)", async () => {
    await expect(page).toHaveURL(/step=payment/)
    await expect(page.getByTestId("billing-address-summary")).toBeVisible()
    await expect(page.getByTestId("addresses-section")).not.toContainText("จัดส่ง")
    await expect(page.getByTestId("delivery-options-container")).toHaveCount(0)
    await expect(page.getByTestId("delivery-heading")).toHaveCount(0)
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    await page.getByTestId("submit-payment-button").click()
  })

  await step("ยืนยันคำสั่งซื้อ → /th/order/<id>/confirmed", async () => {
    await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 30_000 })
    await evidence("02-review-no-delivery")
    await page.getByTestId("submit-order-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/order/[^/]+/confirmed`), { timeout: 30_000 })
  })

  await step("order: shipping_methods ว่าง, shipping_address = ที่อยู่ที่กรอก, มี VAT", async () => {
    const orderId = new URL(page.url()).pathname.split("/")[3]
    const { order } = await call(
      request,
      admin,
      `/admin/orders/${orderId}?fields=id,tax_total,*shipping_methods,*shipping_address`
    )
    expect(order.shipping_methods).toEqual([])
    expect(order.shipping_address).toMatchObject(BILLING)
    expect(order.tax_total).toBeGreaterThan(0)
  })
})

test("AC-37 (กฎข้อ 24d): cart ผสม voucher + สินค้าจัดส่ง ใช้ flow ปกติที่มีขั้น delivery", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const handle = await createVoucher(request, admin)

  await step("ใส่ voucher + t-shirt ลงตะกร้า", async () => {
    for (const product of [handle, "t-shirt"]) {
      await page.goto(`/${CC}/products/${product}`)
      await page.getByTestId("add-product-button").click()
      await expect(page.getByTestId("add-product-button")).toBeEnabled()
    }
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(2)
    await page.getByTestId("checkout-button").click()
  })

  await step("ฟอร์มที่อยู่จัดส่งเดิม และมีขั้น delivery", async () => {
    await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()
    await expect(page.getByTestId("billing-email-input")).toHaveCount(0)
    await expect(page.getByTestId("delivery-heading")).toBeVisible()
  })
})
