import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_UI,
  STRIPE_SECRET,
  cartIdOf,
  cartPaymentState,
  continueToReview,
  fillCard,
  sessionIntentId,
} from "./support/stripe"
import { WorkflowExecution, cartCompletionSettled } from "./support/cart-completion"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"

// PAY-9 (spec 06 กฎข้อ 11, AC-22 c, ADR-025 — O-2 #69): ลูกค้าอยู่หน้า review (ปุ่มกดได้ — ผ่านด่าน UI ของ FS-21 กฎข้อ 26b)
// แล้วใช้สิทธิ์ flash จาก cart อื่นผ่าน API (แบบสองแท็บ) → กดสั่งด้วยบัตร → capture แล้ว complete ล้ม FLASH_LIMIT_EXCEEDED
// → Medusa คืนเงินอัตโนมัติ → admin เพิ่มสิทธิ์ต่อคน → จ่ายใหม่ใน cart เดิม → order มี payment collection ชุดใหม่ชุดเดียว
// และ payment_status = captured (ไม่ใช่ refunded)
// Stripe test mode จริง; สร้างสินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-9" } })

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

/** flash config ของแคมเปญ: สิทธิ์ต่อคน `perCustomerLimit` ชิ้น (total_cap 50) */
const flashConfig = (perCustomerLimit: number) => ({ per_customer_limit: perCustomerLimit, total_cap: 50, show_countdown: true })

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  const product = await createFlashProduct(request, admin, "PAY9", 100)
  variantId = product.variantId
  campaignId = await createFlashCampaign(request, admin, "PAY9", product.productId, flashConfig(1))
})

async function setLimit(request: APIRequestContext, perCustomerLimit: number) {
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, {
      headers: admin,
      data: flashConfig(perCustomerLimit),
    }),
    "flash sale config"
  )
}

test.afterAll(async ({ request }) => {
  if (campaignId) await endFlashCampaign(request, admin, campaignId)
})

test("AC-22c: ใช้สิทธิ์ flash จาก cart อื่นระหว่างอยู่หน้า review → จ่ายด้วยบัตรแล้วถูกคืนเงิน → จ่ายใหม่ใน cart เดิม → order captured มี payment collection ชุดเดียว", async ({
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
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  expect(await cartIdOf(context)).toBe(cartId)

  let firstIntent = ""
  let firstSessionId = ""
  // ขอบล่างของ execution ที่อ่าน (เผื่อนาฬิกา DB/runner ต่างกัน — ตัดผิด = poll ไม่จบแล้วล้ม ไม่ใช่ผ่านเงียบ)
  const startedAt = new Date(Date.now() - 60_000).toISOString()
  await step("cart 1 ชิ้น (สิทธิ์ 1) ไปถึงขั้น review ด้วยบัตร 4242 → ปุ่มสั่งซื้อกดได้", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    firstIntent = await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
    const firstSession = (await cartPaymentState(request, pk, customer, cartId)).sessions.find(
      (s) => s.provider_id === CARD_PROVIDER
    )
    expect(firstSession, `session ${CARD_PROVIDER} ของ cart ${cartId}`).toBeTruthy()
    firstSessionId = firstSession!.id
    await fillCard(page, "4242424242424242")
    await continueToReview(page)
    await expect(page.getByTestId("review-flash-exceeds-customer-limit")).toHaveCount(0)
    await expect(page.getByTestId("submit-order-button")).toBeEnabled()
  })

  await step("ลูกค้าคนเดิมใช้สิทธิ์ 1 ชิ้นจาก cart อื่นผ่าน API (แบบสองแท็บ) ขณะหน้า review เปิดค้าง", async () => {
    await placeOrder(request, pk, customer, { variant: variantId, quantity: 1 })
    expect(await cartIdOf(context)).toBe(cartId) // cookie ของ browser ยังเป็น cart เดิม
  })

  await step("กดสั่งซื้อ → Stripe capture แล้ว complete ล้ม FLASH_LIMIT_EXCEEDED (ข้อความไทย)", async () => {
    await page.getByTestId("submit-order-button").click()
    // FS-22 (spec 03 กฎข้อ 27, AC-29): ตัดเงินแล้ว → แจ้งว่าคืนเงินอัตโนมัติ ไม่ใช่ error ให้ลองใหม่
    const failure = page.getByTestId("checkout-refunded-notice")
    await expect(failure).toBeVisible({ timeout: 60_000 })
    await expect(failure).toHaveText(/[\u0E00-\u0E7F]/)
    await expect(failure).toContainText("คืนเงิน")
    await expect(page.getByTestId("stripe-payment-error-message")).toHaveCount(0)
    await expect(page).toHaveURL(/\/checkout/)
    await evidence("01-flash-limit-after-card-payment")
  })

  await step("Medusa คืนเงินอัตโนมัติเต็มจำนวน (compensatePaymentIfNeededStep)", async () => {
    await expect
      .poll(async () => (await stripeRefunds(request, firstIntent)).map((r) => r.status), { timeout: 60_000 })
      .toEqual(["succeeded"])
    // Stripe/Medusa มี refund ก่อน compensation ของ Medusa จบ: ยัง recreate session ด้วย PI เดิม 2 รอบ (แถว pending ชั่วคราว)
    // ถ้าไปหน้า payment ช่วงนั้น checkout เลือก session ชั่วคราวไว้ (CI run 44896944640/44902940179/44907726201)
    // → รอ execution ของ complete-cart ของ cart นี้จบทุกตัว (ดู support/cart-completion.ts)
    const executions = async (): Promise<WorkflowExecution[]> =>
      (
        await ok(
          await request.get(
            `${BACKEND_URL}/admin/workflows-executions?workflow_id=complete-cart&fields=id,state,context` +
              `&created_at[$gte]=${encodeURIComponent(startedAt)}`,
            { headers: admin }
          ),
          "admin workflow executions"
        )
      ).workflow_executions
    await expect
      .poll(async () => cartCompletionSettled(await executions(), cartId), { timeout: 60_000 })
      .toBe(true)
    // หลัง compensation จบ: Medusa บันทึก refund 1 รายการ และไม่เหลือ session ที่อ้าง PI แรก (ไม่ poll — ต้องเป็นจริงทันที)
    const { payments } = await ok(
      await request.get(`${BACKEND_URL}/admin/payments?payment_session_id=${firstSessionId}`, { headers: admin }),
      "admin payments"
    )
    expect(payments).toHaveLength(1)
    expect(payments[0].refunds).toEqual([expect.objectContaining({ note: "Refunded due to cart completion failure" })])
    const { sessions } = await cartPaymentState(request, pk, customer, cartId)
    expect(sessions.filter((s) => s.data?.id === firstIntent)).toEqual([])
  })

  await step("admin เพิ่มสิทธิ์ต่อคนเป็น 2 (คืนสิทธิ์ให้ cart เดิมจ่ายได้ — ด่าน FS-21 ไม่ปิดปุ่ม)", async () => {
    await setLimit(request, 2)
  })

  await step("จ่ายใหม่ด้วยบัตรใน cart เดิม → หน้า order confirmed", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    // collection เดิมถูกถอด (409 PAYMENT_COLLECTION_RESET) storefront สร้าง collection ใหม่แล้วได้ PaymentIntent ใหม่
    // (ไม่มี session ที่อ้าง PI แรกแล้ว — PI ที่ sessionIntentId รอเจอจึงเป็นของ session ใหม่)
    expect(await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)).not.toBe(firstIntent)
    await fillCard(page, "4242424242424242")
    await continueToReview(page)
    await expect(page.getByTestId("submit-order-button")).toBeEnabled()
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
