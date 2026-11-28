import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_UI,
  PROMPTPAY_PROVIDER,
  STRIPE_SECRET,
  cartIdOf,
  checkoutToPayment,
  continueToReview,
  retrievePaymentIntent,
  sessionIntentId,
} from "./support/stripe"

// PAY-26 (spec 01 กฎข้อ 157, AC-199, ADR-035): ลูกค้าที่สร้าง session บัตรแล้วเพิ่มที่อยู่ในบัญชี ยังเลือกพร้อมเพย์ได้ (เดิม 500 —
// idempotency key ของ Stripe customer ซ้ำข้าม provider, medusajs/medusa#12526) และบัตร/พร้อมเพย์ใช้ Stripe customer ตัวเดียว
test.use({ evidenceTarget: { feature: "r51", taskId: "PAY-26" } })

test("AC-199: บัตร → เพิ่มที่อยู่ในบัญชี → พร้อมเพย์แสดง QR และ Stripe มี customer ตัวเดียว", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  test.setTimeout(180_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  await signInAs(context, baseURL!, customer)

  let cartId = ""
  let cardIntent = ""
  await step("Given ลูกค้าใหม่ที่ไม่มีที่อยู่ในบัญชี เลือกบัตร → cart มี session บัตร", async () => {
    const me = await request.get(`${BACKEND_URL}/store/customers/me?fields=addresses.id`, { headers: auth })
    expect((await me.json()).customer.addresses).toEqual([])
    await checkoutToPayment(page, context, request, pk, customer, CC, "t-shirt")
    cartId = await cartIdOf(context)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    cardIntent = await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
  })

  await step("When เพิ่มที่อยู่ในบัญชี (ข้อมูลที่ส่งให้ Stripe customer เปลี่ยน)", async () => {
    const res = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
      headers: auth,
      data: {
        first_name: "Somchai",
        last_name: "Jaidee",
        address_1: "1 Sukhumvit Rd",
        city: "Bangkok",
        postal_code: "10110",
        country_code: CC,
        is_default_billing: true,
      },
    })
    expect(res.status(), "add address").toBe(200)
  })

  await step("And กลับ checkout เลือกพร้อมเพย์แล้วสั่งซื้อ → Then QR แสดง", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await continueToReview(page)
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
    await page.getByTestId("promptpay-qr").scrollIntoViewIfNeeded()
    await evidence("01-promptpay-qr-after-card-and-new-address")
  })

  await step("And Stripe มี customer ของอีเมลนี้ 1 ตัว และ PaymentIntent ทั้งสองวิธีชี้ customer นั้น", async () => {
    const res = await request.get(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(customer.email)}`, {
      headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    })
    expect(res.status(), "list Stripe customers").toBe(200)
    const { data } = await res.json()
    expect(data, "Stripe customers ของอีเมลนี้").toHaveLength(1)
    const promptpayIntent = await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
    const [card, promptpay] = await Promise.all([
      retrievePaymentIntent(request, cardIntent),
      retrievePaymentIntent(request, promptpayIntent),
    ])
    expect([card, promptpay].map((pi) => (pi as { customer?: string }).customer)).toEqual([data[0].id, data[0].id])
  })
})
