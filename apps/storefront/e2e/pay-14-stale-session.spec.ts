import { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
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
  cartPaymentState,
  continueToReview,
  fillCard,
  retrievePaymentIntent,
  sessionIntentId,
} from "./support/stripe"
import { THAI, latinWordsOutsideAllowList } from "./support/thai-text"

// PAY-14 (spec 06 กฎข้อ 16, AC-27 a/b/c): session บัตรที่เลือกอยู่ชี้ PaymentIntent ที่จบแล้ว (แบบ session ชั่วคราวระหว่าง compensation)
// → ขั้น payment ไม่ mount Elements กับ PI นั้น สร้าง session ใหม่อัตโนมัติ (PI ใหม่) และไม่แสดงข้อความอังกฤษของ Stripe
// Stripe test mode จริง: ยกเลิก PI ของ session ที่ cart ถืออยู่ด้วย secret key (cart ยังชี้ PI นั้นเป็น session `pending`)
// หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-14" } })

let pk: string

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  pk = await publishableKey(request, await adminHeaders(request))
})

async function cancelIntent(request: APIRequestContext, id: string) {
  const res = await request.post(`https://api.stripe.com/v1/payment_intents/${id}/cancel`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), `cancel PaymentIntent ${id}`).toBe(200)
}

/** cart ที่ session บัตรชี้ PI ที่ถูกยกเลิกแล้ว — คืน PI เดิม */
async function cartWithStaleCardSession(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  baseURL: string,
  customer: Customer
) {
  await signInAs(context, baseURL, customer)
  const cartId = await cartReadyForPayment(request, pk, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  expect(await cartIdOf(context)).toBe(cartId)
  await page.goto(`/${CC}/checkout?step=payment`)
  await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
  const staleIntent = await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
  await cancelIntent(request, staleIntent)
  expect((await retrievePaymentIntent(request, staleIntent)).status).toBe("canceled")
  return { cartId, staleIntent }
}

/** cart มี session บัตรที่ชี้ PI ใหม่ (ไม่ใช่ PI เดิม) แล้วหรือยัง */
const hasNewIntent = (request: APIRequestContext, customer: Customer, cartId: string, staleIntent: string) => async () => {
  const { sessions } = await cartPaymentState(request, pk, customer, cartId)
  const id = sessions.find((s) => s.provider_id === CARD_PROVIDER)?.data?.id ?? ""
  return id.startsWith("pi_") && id !== staleIntent
}

/** server action สร้าง session ของบัตรจากหน้า checkout (body มี provider_id) */
const isCardSessionAction = (req: { method(): string; headers(): Record<string, string>; postData(): string | null }) =>
  req.method() === "POST" && !!req.headers()["next-action"] && (req.postData() ?? "").includes(CARD_PROVIDER)

/** ข้อความ error ที่มองเห็นในขั้น payment ต้องไม่ใช่ข้อความอังกฤษของ Stripe */
async function expectNoStripeEnglish(page: Page) {
  await expect(page.locator("body")).not.toContainText(/terminal state/i)
  for (const id of ["payment-method-error-message", "payment-session-pending-error", "payment-session-reset-notice"]) {
    const el = page.getByTestId(id)
    if (await el.isVisible().catch(() => false)) {
      await expect(el).toHaveText(THAI)
      expect(latinWordsOutsideAllowList((await el.textContent()) ?? ""), id).toEqual([])
    }
  }
}

test("AC-27 a/b/c: session ชี้ PI ที่จบแล้ว → สร้าง session ใหม่อัตโนมัติ ไม่ confirm PI เดิม แล้วจ่ายได้ order captured", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const customer = await createCustomer(request, pk)
  const { cartId, staleIntent } = await cartWithStaleCardSession(page, context, request, baseURL!, customer)
  const staleConfirms: string[] = []
  let sessionActions = 0
  page.on("request", (r) => {
    if (r.url().includes(`/v1/payment_intents/${staleIntent}/confirm`)) staleConfirms.push(r.url())
    if (isCardSessionAction(r)) sessionActions++
  })

  await step("เปิดขั้น payment ใหม่ → ภายใน 10 วินาที cart ได้ PI ใหม่และ Elements mount กับ PI ใหม่", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await expect.poll(hasNewIntent(request, customer, cartId, staleIntent), { timeout: 10_000 }).toBe(true)
    expect(sessionActions).toBe(1)
    await fillCard(page, "4242424242424242")
    await expect(page.getByTestId("payment-session-reset-notice")).toHaveCount(0)
    await expectNoStripeEnglish(page)
    await evidence("01-new-session-after-stale-intent")
  })

  await step("จ่ายด้วย session ใหม่ → order confirmed, ไม่มี confirm กับ PI เดิม, payment captured", async () => {
    await continueToReview(page)
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
    expect(staleConfirms).toEqual([])
    const orderId = page.url().match(/\/order\/([^/]+)\/confirmed/)![1]
    const admin = await adminHeaders(request)
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

test("AC-27 a: สร้างอัตโนมัติล้ม 1 ครั้ง → notice ไทย แล้วคลิกตัวเลือกบัตรที่เลือกอยู่ → ได้ session ใหม่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const customer = await createCustomer(request, pk)
  const { cartId, staleIntent } = await cartWithStaleCardSession(page, context, request, baseURL!, customer)

  await step("server action สร้าง session ของบัตรครั้งแรกตอบ 500 → payment-session-reset-notice", async () => {
    let failed = 0
    await page.route(`**/${CC}/checkout**`, async (route) => {
      if (isCardSessionAction(route.request()) && failed === 0) {
        failed++
        return route.fulfill({ status: 500, body: "" })
      }
      return route.fallback()
    })
    await page.goto(`/${CC}/checkout?step=payment`)
    const notice = page.getByTestId("payment-session-reset-notice")
    await expect(notice).toBeVisible({ timeout: 10_000 })
    await expect(notice).toHaveText(THAI)
    expect(failed).toBe(1)
    await expectNoStripeEnglish(page)
    await evidence("02-session-reset-notice")
  })

  await step("คลิก radio บัตรที่เลือกอยู่ → สร้าง session ใหม่สำเร็จ (PI ใหม่) และ notice หาย", async () => {
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await expect.poll(hasNewIntent(request, customer, cartId, staleIntent), { timeout: 15_000 }).toBe(true)
    await expect(page.getByTestId("payment-session-reset-notice")).toHaveCount(0)
    await fillCard(page, "4242424242424242")
    await expectNoStripeEnglish(page)
  })
})
