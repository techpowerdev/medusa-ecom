import { APIRequestContext, Page } from "@playwright/test"

import { REFUNDED_NOTICE } from "../src/lib/util/checkout-error"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, cartPaymentState, continueToReview, fillCard, sessionIntentId } from "./support/stripe"
import { THAI } from "./support/thai-text"

// FS-24 (spec 03 กฎข้อ 29, AC-31 — แทนส่วน route mock ทางบัตรของ AC-29): race จริงกับ Stripe test mode
// ลูกค้าสองคนอยู่ขั้น review ด้วยบัตร 4242 พร้อมกัน แย่งสิทธิ์ flash ชิ้นสุดท้าย (total_cap 1) แล้วกด "สั่งซื้อ" พร้อมกัน
// ผู้ชนะได้ order; ผู้แพ้: FLASH_SOLD_OUT ล้มก่อน authorize ใน request ของ storefront → `checkout-refunded-notice`
// ส่วนเงินคืนในเส้นทางของ webhook (processPaymentWorkflow → complete ล้ม → compensation) — notice อาจขึ้นก่อน refund จริงไม่กี่วินาที
// จึงตรวจ refund ด้วย expect.poll ภายใน 30 วินาทีหลังเห็น notice (ไม่ใช้ waitForTimeout/retries)
// สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-24" } })

const PRICE = 1000

let admin: Headers
let pk: string

type Racer = { page: Page; customer: Customer; cartId: string; sessionId: string; total: number }

const storeHeaders = (customer: Customer) => ({ authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk })

/** สินค้าใหม่ 1 variant (สต็อก 100) + แคมเปญ flash ลด 20% total_cap 1 ที่เริ่มแล้ว คืน variant + campaign id */
async function lastFlashUnit(request: APIRequestContext) {
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }), path)
  const run = `${Date.now()}`
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS24 ${run}`,
    handle: `e2e-fs24-${run}`,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS24-${run}`,
        options: { Size: "M" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: PRICE }],
      },
    ],
  })
  await post(`/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`, {
    location_id: stock_locations[0].id,
    stocked_quantity: 100,
  })
  const { campaign } = await post("/admin/campaigns", {
    name: `FS-24 ${run}`,
    campaign_identifier: `fs24-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  return { variantId: product.variants[0].id as string, productId: product.id as string, campaignId: campaign.id as string, run }
}

/** ลูกค้าใหม่ใน browser context ของตัวเอง: cart 1 ชิ้นถึงขั้น review ด้วยบัตร 4242 (ปุ่มสั่งซื้อกดได้) */
async function racerAtReview(page: Page, request: APIRequestContext, baseURL: string, variantId: string): Promise<Racer> {
  const customer = await createCustomer(request, pk)
  await signInAs(page.context(), baseURL, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
  await page.context().addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  await page.goto(`/${CC}/checkout?step=payment`)
  await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
  await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
  const session = (await cartPaymentState(request, pk, customer, cartId)).sessions.find((s) => s.provider_id === CARD_PROVIDER)
  expect(session, `session ${CARD_PROVIDER} ของ cart ${cartId}`).toBeTruthy()
  await fillCard(page, "4242424242424242")
  await continueToReview(page)
  await expect(page.getByTestId("submit-order-button")).toBeEnabled()
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,total`, { headers: storeHeaders(customer) }),
    "cart total"
  )
  return { page, customer, cartId, sessionId: session!.id, total: cart.total }
}

const orderIdsOf = async (request: APIRequestContext, customer: Customer): Promise<string[]> =>
  (
    await ok(await request.get(`${BACKEND_URL}/store/orders?fields=id`, { headers: storeHeaders(customer) }), "store orders")
  ).orders.map((o: { id: string }) => o.id)

/** payment ของ session (สร้างตอน webhook authorize) และยอด refund ผ่าน `GET /admin/payments/:id` — ยังไม่มี payment = null */
async function paymentRefunds(request: APIRequestContext, sessionId: string) {
  const { payments } = await ok(
    await request.get(`${BACKEND_URL}/admin/payments?payment_session_id=${sessionId}&fields=id`, { headers: admin }),
    "admin payments"
  )
  if (payments.length !== 1) return { payments: payments.length }
  const { payment } = await ok(
    await request.get(`${BACKEND_URL}/admin/payments/${payments[0].id}?fields=id,amount,*refunds`, { headers: admin }),
    "admin payment"
  )
  return {
    payments: 1,
    amount: Number(payment.amount),
    refunds: (payment.refunds as { amount: number }[]).map((r) => Number(r.amount)),
  }
}

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
})

test("AC-31: สองลูกค้าแย่ง flash ชิ้นสุดท้าย (cap 1) ด้วยบัตร 4242 → ผู้ชนะได้ order, ผู้แพ้เห็น checkout-refunded-notice และได้ refund เต็มจำนวนภายใน 30 วินาที", async ({
  browser,
  page,
  request,
  baseURL,
  step,
}, testInfo) => {
  test.setTimeout(240_000)
  const { variantId, productId, campaignId, run } = await lastFlashUnit(request)
  const other = await browser.newContext({ baseURL })
  try {
    await ok(
      await request.post(`${BACKEND_URL}/admin/promotions`, {
        headers: admin,
        data: {
          code: `FS24-FLASH-${run}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaignId,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "across",
            value: 20,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
          },
        },
      }),
      "promotion"
    )
    await ok(
      await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, {
        headers: admin,
        data: { total_cap: 1, show_countdown: true },
      }),
      "flash sale config"
    )

    let racers: Racer[] = []
    await step("ลูกค้า A และ B (คนละ browser context) ไปถึงขั้น review ด้วยบัตร 4242", async () => {
      racers = [
        await racerAtReview(page, request, baseURL!, variantId),
        await racerAtReview(await other.newPage(), request, baseURL!, variantId),
      ]
    })

    let winner!: Racer
    let loser!: Racer
    await step("กด สั่งซื้อ พร้อมกันทั้งสองคน → คนหนึ่งได้หน้า order อีกคนเห็น notice คืนเงิน", async () => {
      await Promise.all(racers.map((r) => r.page.getByTestId("submit-order-button").click()))
      const outcome = (r: Racer) =>
        r.page.getByTestId("order-complete-container").or(r.page.getByTestId("checkout-refunded-notice"))
      await Promise.all(racers.map((r) => expect(outcome(r)).toBeVisible({ timeout: 60_000 })))
      const won = await Promise.all(racers.map((r) => r.page.getByTestId("order-complete-container").isVisible()))
      expect(won.filter(Boolean), `ผู้ชนะต้องมีคนเดียว (A, B) = ${won}`).toHaveLength(1)
      winner = racers[won.indexOf(true)]
      loser = racers[won.indexOf(false)]
    })

    await step("ผู้แพ้: checkout-refunded-notice ภาษาไทย ไม่มีข้อความให้ลองใหม่ และยังอยู่หน้า checkout", async () => {
      const notice = loser.page.getByTestId("checkout-refunded-notice")
      await expect(notice).toHaveText(REFUNDED_NOTICE)
      await expect(notice).toHaveText(THAI)
      await expect(notice).toContainText("คืนเงิน")
      await expect(notice).not.toContainText("ลองใหม่")
      await expect(loser.page.getByTestId("stripe-payment-error-message")).toHaveCount(0)
      await expect(loser.page).toHaveURL(/\/checkout/)
      await testInfo.attach("loser-refunded-notice", { body: await loser.page.screenshot(), contentType: "image/png" })
    })

    await step("ผู้แพ้: ภายใน 30 วินาที GET /admin/payments/:id มี refund เต็มจำนวน (เส้นทาง webhook)", async () => {
      await expect
        .poll(() => paymentRefunds(request, loser.sessionId), { timeout: 30_000 })
        .toEqual({ payments: 1, amount: loser.total, refunds: [loser.total] })
    })

    await step("ผู้แพ้ไม่มี order และ cart ยังไม่ complete; ผู้ชนะมี order ตรงกับหน้า confirmed", async () => {
      expect(await orderIdsOf(request, loser.customer)).toEqual([])
      expect((await cartPaymentState(request, pk, loser.customer, loser.cartId)).completed_at).toBeNull()
      const orderId = winner.page.url().match(/\/order\/([^/]+)\/confirmed/)?.[1]
      expect(orderId, `URL ของผู้ชนะ ${winner.page.url()}`).toBeTruthy()
      expect(await orderIdsOf(request, winner.customer)).toEqual([orderId])
    })
  } finally {
    await other.close()
    await ok(
      await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
        headers: admin,
        data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
      }),
      "end campaign"
    )
  }
})
