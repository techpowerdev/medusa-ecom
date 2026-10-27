import { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { expect } from "./fixtures"
import { STOREFRONT_COUNTRY as CC, Customer, Headers, adminHeaders, createCustomer, publishableKey, signInAs } from "./medusa"
import {
  PROMPTPAY_PROVIDER,
  STRIPE_SECRET,
  cartIdOf,
  checkoutToPayment,
  continueToReview,
  retrievePaymentIntent,
  sessionIntentId,
} from "./stripe"

// PAY-6b (ย้ายมาจาก payments-promptpay-already-paid.spec.ts ใน PAY-6c เพื่อใช้ร่วมกัน): QR หมดอายุแต่ลูกค้าชำระไปแล้ว (race)
// โดย webhook "ไม่มา" — ดูคำอธิบายใน payments-promptpay-already-paid.spec.ts

const PRODUCT = "t-shirt"

export type Ctx = { admin: Headers; pk: string; customer: Customer; cartId: string; intentId: string; seen: Set<string> }

/** ลบ metadata.session_id ของ PI (test mode) — webhook ของ PI นี้ผูกกับ session ไม่ได้ = จำลอง "webhook ไม่มา" */
async function detachWebhook(request: APIRequestContext, intentId: string) {
  const res = await request.post(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    form: { "metadata[session_id]": "" },
  })
  expect(res.status(), `update PaymentIntent ${intentId}`).toBe(200)
  expect((await res.json()).metadata?.session_id).toBeUndefined()
}

/** จด test id ที่เคยแสดง (exposeFunction อยู่รอดข้าม navigation ไปหน้า confirmed) */
async function trackTestIds(page: Page, ids: string[]) {
  const seen = new Set<string>()
  await page.exposeFunction("__pay6bSeen", (id: string) => seen.add(id))
  await page.addInitScript((watch: string[]) => {
    new MutationObserver(() => {
      for (const id of watch) {
        if (document.querySelector(`[data-testid="${id}"]`)) {
          ;(window as unknown as { __pay6bSeen: (id: string) => void }).__pay6bSeen(id)
        }
      }
    }).observe(document, { childList: true, subtree: true })
  }, ids)
  return seen
}

/** checkout → QR → ตัด webhook → ลูกค้าชำระสำเร็จ แต่ browser ยังเห็น PI เป็น requires_action */
export async function paidWhileQrShown(page: Page, context: BrowserContext, request: APIRequestContext, baseURL: string): Promise<Ctx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL, customer)
  const seen = await trackTestIds(page, ["promptpay-awaiting-order", "promptpay-expired"])

  await page.clock.install()
  await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
  const cartId = await cartIdOf(context)
  await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
  await continueToReview(page)
  await page.getByTestId("submit-order-button").click()
  await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
  const intentId = await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
  await detachWebhook(request, intentId)

  await page.route(new RegExp(`api\\.stripe\\.com/v1/payment_intents/${intentId}\\?`), async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, json: { ...(await res.json()), status: "requires_action" } })
  })
  const intent = await retrievePaymentIntent(request, intentId)
  const bank = await context.newPage()
  await bank.goto(intent.next_action!.promptpay_display_qr_code!.data)
  await bank.getByRole("button", { name: /authorize test payment/i }).click()
  await expect
    .poll(async () => (await retrievePaymentIntent(request, intentId)).status, { timeout: 60_000, intervals: [500] })
    .toBe("succeeded")
  await bank.close()
  return { admin, pk, customer, cartId, intentId, seen }
}
