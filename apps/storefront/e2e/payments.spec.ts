import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_SECRET,
  HAS_STRIPE_UI,
  PROMPTPAY_PROVIDER,
  cartIdOf,
  cartPaymentState,
  checkoutToPayment,
  fillCard,
  retrievePaymentIntent,
  sessionIntentId,
} from "./support/stripe"

// PAY-2: spec 06 AC-1..AC-5, AC-9 — Stripe test mode จริง (webhook ผ่าน `stripe listen` ใน CI)
// ต้องมี STRIPE_API_KEY (sk_test_) และ NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe ไทยบัญชีเดียวกัน
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-2" } })

const PRODUCT = "t-shirt"
const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

type Ctx = { admin: Headers; pk: string; customer: Customer }

async function setup(request: Parameters<typeof adminHeaders>[0]): Promise<Ctx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  return { admin, pk, customer }
}

async function orderPaymentStatus(request: Parameters<typeof adminHeaders>[0], admin: Headers, orderId: string) {
  const res = await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,payment_status`, { headers: admin })
  expect(res.status()).toBe(200)
  return (await res.json()).order.payment_status as string
}

const orderIdFromUrl = (url: string) => url.match(/\/order\/([^/]+)\/confirmed/)![1]

test("AC-9: session บัตรจาก checkout → PaymentIntent มี payment_method_types ['card']; PromptPay → ['promptpay']", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.skip(!HAS_STRIPE_SECRET, "ต้องตั้ง STRIPE_API_KEY (sk_test_)")
  const { pk, customer } = await setup(request)
  await signInAs(context, baseURL!, customer)
  await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
  const cartId = await cartIdOf(context)

  await step("เลือก Credit card → PaymentIntent ใน Stripe เป็น card เท่านั้น", async () => {
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    const intent = await retrievePaymentIntent(
      request,
      await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
    )
    expect(intent.payment_method_types).toEqual(["card"])
  })

  await step("เลือก PromptPay → PaymentIntent เป็น promptpay เท่านั้น", async () => {
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    const intent = await retrievePaymentIntent(
      request,
      await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
    )
    expect(intent.payment_method_types).toEqual(["promptpay"])
  })
})

test.describe("บัตร (Stripe Elements)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  async function payByCard(page: import("@playwright/test").Page, number: string) {
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, number)
    await page.getByTestId("submit-payment-button").click()
    await page.getByTestId("submit-order-button").click()
  }

  test("AC-1: บัตร 4242 → order สำเร็จ payment_status=captured", async ({ page, context, request, baseURL, step, evidence }) => {
    test.setTimeout(120_000)
    const { admin, pk, customer } = await setup(request)
    await signInAs(context, baseURL!, customer)
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)

    await step("ชำระด้วย 4242 4242 4242 4242", async () => {
      await payByCard(page, "4242424242424242")
      await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
      await evidence("01-card-order-confirmed")
    })

    await step("admin: order เป็น captured", async () => {
      const orderId = orderIdFromUrl(page.url())
      await expect.poll(() => orderPaymentStatus(request, admin, orderId), { timeout: 30_000 }).toBe("captured")
    })
  })

  test("AC-2: บัตร 3DS (4000 0027 6000 3184) → 3DS modal → สำเร็จ", async ({ page, context, request, baseURL, step, evidence }) => {
    test.setTimeout(120_000)
    const { admin, pk, customer } = await setup(request)
    await signInAs(context, baseURL!, customer)
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)

    await step("ชำระด้วยบัตร 3DS แล้วยืนยันใน modal", async () => {
      await payByCard(page, "4000002760003184")
      const challenge = page
        .frameLocator('iframe[src*="three-ds-2-challenge"]')
        .frameLocator("#challengeFrame")
      await expect(challenge.locator("#test-source-authorize-3ds")).toBeVisible({ timeout: 30_000 })
      await evidence("02-card-3ds-modal")
      await challenge.locator("#test-source-authorize-3ds").click()
      await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
    })

    await step("admin: order เป็น captured", async () => {
      const orderId = orderIdFromUrl(page.url())
      await expect.poll(() => orderPaymentStatus(request, admin, orderId), { timeout: 30_000 }).toBe("captured")
    })
  })

  test("AC-3: บัตรถูกปฏิเสธ (4000 0000 0000 0002) → แสดง error, ไม่สร้าง order, cart ยังอยู่", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const { pk, customer } = await setup(request)
    await signInAs(context, baseURL!, customer)
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
    const cartId = await cartIdOf(context)

    await step("ชำระด้วยบัตรที่ถูกปฏิเสธ → error บนหน้า checkout", async () => {
      await payByCard(page, "4000000000000002")
      await expect(page.getByTestId("stripe-payment-error-message")).toBeVisible({ timeout: 30_000 })
      await expect(page).toHaveURL(/\/checkout/)
      await evidence("03-card-declined-error")
    })

    await step("ไม่มี order: cart ยังไม่ completed และยังมีสินค้า", async () => {
      const state = await cartPaymentState(request, pk, customer, cartId)
      expect(state.completed_at).toBeNull()
      await page.goto(`/${CC}/cart`)
      await expect(page.getByTestId("product-row")).toHaveCount(1)
    })
  })
})

test.describe("PromptPay (QR + polling)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("AC-4: แสดง QR → authorize test payment → webhook → order captured", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const { admin, pk, customer } = await setup(request)
    await signInAs(context, baseURL!, customer)
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
    const cartId = await cartIdOf(context)
    let qrPayload = ""

    await step("เลือก PromptPay → review → แสดง QR", async () => {
      await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
      await page.getByTestId("submit-payment-button").click()
      await page.getByTestId("submit-order-button").click()
      await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId("promptpay-countdown")).toHaveText(/^\d+:\d{2}$/)
      await evidence("04-promptpay-qr")

      const intent = await retrievePaymentIntent(
        request,
        await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
      )
      expect(intent.status).toBe("requires_action")
      qrPayload = intent.next_action!.promptpay_display_qr_code!.data
    })

    await step("confirm PaymentIntent ใน test mode (หน้า test payment ของ Stripe)", async () => {
      const bank = await context.newPage()
      await bank.goto(qrPayload)
      await bank.getByRole("button", { name: /authorize test payment/i }).click()
      await bank.close()
    })

    await step("webhook สร้าง order → storefront poll แล้วไปหน้า confirmed", async () => {
      await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 90_000 })
      const orderId = orderIdFromUrl(page.url())
      await expect.poll(() => orderPaymentStatus(request, admin, orderId), { timeout: 30_000 }).toBe("captured")
      await evidence("05-promptpay-order-confirmed")
    })
  })

  test("AC-5: ไม่ชำระภายใน 10 นาที → session ถูกยกเลิก, cart ยังใช้งานได้", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    test.setTimeout(180_000)
    const { pk, customer } = await setup(request)
    await signInAs(context, baseURL!, customer)
    await page.clock.install()
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
    const cartId = await cartIdOf(context)
    let firstIntentId = ""

    await step("แสดง QR ของ PromptPay", async () => {
      await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
      await page.getByTestId("submit-payment-button").click()
      await page.getByTestId("submit-order-button").click()
      await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
      firstIntentId = await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
    })

    await step("เวลาผ่านไป 10 นาที → QR หมดอายุ, PaymentIntent เดิมถูก cancel", async () => {
      await page.clock.fastForward("10:01")
      await expect(page.getByTestId("promptpay-expired")).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId("promptpay-qr")).toBeHidden()
      await expect
        .poll(async () => (await retrievePaymentIntent(request, firstIntentId)).status, { timeout: 30_000 })
        .toBe("canceled")
    })

    await step("cart ยังใช้งานได้: ยังไม่ completed และลองใหม่ได้ QR ใหม่", async () => {
      const state = await cartPaymentState(request, pk, customer, cartId)
      expect(state.completed_at).toBeNull()
      await page.getByTestId("promptpay-retry-button").click()
      await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
      expect(await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)).not.toBe(firstIntentId)
    })
  })
})
