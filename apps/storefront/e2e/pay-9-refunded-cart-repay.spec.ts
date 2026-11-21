import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_UI,
  STRIPE_SECRET,
  cartIdOf,
  continueToReview,
  fillCard,
  sessionIntentId,
} from "./support/stripe"

// PAY-9 (spec 06 กฎข้อ 11, AC-22 c, ADR-025 — O-2 #69): ซื้อ flash เกินสิทธิ์ด้วยบัตร → Medusa คืนเงินอัตโนมัติ
// → ลดจำนวนแล้วจ่ายใหม่ใน cart เดิม → order มี payment collection ชุดใหม่ชุดเดียว และ payment_status = captured (ไม่ใช่ refunded)
// Stripe test mode จริง; สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-9" } })

const PRICE = 1000

let admin: Headers
let pk: string
let variantId: string
let campaignId: string

async function stripeRefunds(request: APIRequestContext, intentId: string): Promise<{ status: string }[]> {
  const res = await request.get(`https://api.stripe.com/v1/refunds?payment_intent=${intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), `list refunds of ${intentId}`).toBe(200)
  return (await res.json()).data
}

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }), path)
  const run = `${Date.now()}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")

  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E PAY9 ${run}`,
    handle: `e2e-pay9-${run}`,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `PAY9-${run}`,
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
    name: `PAY-9 ${run}`,
    campaign_identifier: `pay9-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  await post("/admin/promotions", {
    code: `PAY9-FLASH-${run}`,
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
  await post(`/admin/flash-sales/${campaignId}/config`, { per_customer_limit: 1, total_cap: 50, show_countdown: true })
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

test("AC-22c: flash เกินสิทธิ์ด้วยบัตร → คืนเงิน → ลดจำนวนแล้วจ่ายใหม่ใน cart เดิม → order captured มี payment collection ชุดเดียว", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(240_000)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 2 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  expect(await cartIdOf(context)).toBe(cartId)

  let firstIntent = ""
  await step("จ่ายด้วยบัตร 4242 ขณะ cart มี 2 ชิ้น (สิทธิ์ 1) → complete ล้ม FLASH_LIMIT_EXCEEDED (ข้อความไทย)", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    firstIntent = await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
    await fillCard(page, "4242424242424242")
    await continueToReview(page)
    await page.getByTestId("submit-order-button").click()
    // FS-22 อาจแทน error ด้วย checkout-refunded-notice — test นี้ตรวจแค่ว่า complete ล้มและยังอยู่หน้า checkout
    const failure = page.getByTestId("stripe-payment-error-message").or(page.getByTestId("checkout-refunded-notice"))
    await expect(failure).toBeVisible({ timeout: 60_000 })
    await expect(failure).toHaveText(/[\u0E00-\u0E7F]/)
    await expect(page).toHaveURL(/\/checkout/)
    await evidence("01-flash-limit-after-card-payment")
  })

  await step("Medusa คืนเงินอัตโนมัติเต็มจำนวน (compensatePaymentIfNeededStep)", async () => {
    await expect
      .poll(async () => (await stripeRefunds(request, firstIntent)).map((r) => r.status), { timeout: 60_000 })
      .toEqual(["succeeded"])
  })

  await step("ลดจำนวนเหลือ 1 ใน /th/cart", async () => {
    await page.goto(`/${CC}/cart`)
    await page.getByTestId("product-select-button").selectOption("1")
    await expect(page.getByTestId("product-select-button")).toHaveValue("1")
  })

  await step("จ่ายใหม่ด้วยบัตรใน cart เดิม → หน้า order confirmed", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    // collection เดิมถูกถอด (409 PAYMENT_COLLECTION_RESET) storefront สร้าง collection ใหม่แล้วได้ PaymentIntent ใหม่
    await expect
      .poll(() => sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER), { timeout: 30_000 })
      .not.toBe(firstIntent)
    await fillCard(page, "4242424242424242")
    await continueToReview(page)
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
    await evidence("02-repay-order-confirmed")
  })

  await step("admin: payment_status = captured และ payment collection 1 ชุด (แทน #69 ที่ขึ้น refunded)", async () => {
    const orderId = page.url().match(/\/order\/([^/]+)\/confirmed/)![1]
    const read = async () =>
      (
        await ok(
          await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,payment_status,*payment_collections`, {
            headers: admin,
          }),
          "admin order"
        )
      ).order
    await expect.poll(async () => (await read()).payment_status, { timeout: 30_000 }).toBe("captured")
    expect((await read()).payment_collections).toHaveLength(1)
  })
})
