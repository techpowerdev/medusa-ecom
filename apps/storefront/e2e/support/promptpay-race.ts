import { APIRequestContext, BrowserContext, Page, Route } from "@playwright/test"

import { expect } from "./fixtures"
import { STOREFRONT_COUNTRY as CC, Customer, Headers, adminHeaders, createCustomer, publishableKey, signInAs } from "./medusa"
import { isCartIdActionBody } from "./server-action"
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

/**
 * checkout → QR → ตัด webhook → ลูกค้าชำระสำเร็จ แต่ browser ยังเห็น PI เป็น requires_action
 * `watch` = test id เพิ่มเติมที่จดใน `seen` (PAY-17: `promptpay-retry-button` ต้องไม่โผล่ระหว่างทาง)
 */
export async function paidWhileQrShown(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  baseURL: string,
  watch: string[] = []
): Promise<Ctx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL, customer)
  const seen = await trackTestIds(page, ["promptpay-awaiting-order", "promptpay-expired", ...watch])

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

// PAY-11 (ย้ายมาใน PAY-15 เพื่อใช้ร่วมกัน): route mock ผลของ placeOrder ในทางสำรอง — ดูคำอธิบายใน pay-11-promptpay-refund-reason.spec.ts
export type Mocked = { placeOrders: number[]; polls: number[]; refundedPolls: number[] }

/** PAY-17 (spec 06 กฎข้อ 19b): placeOrder ค้างไว้จนมี poll ตอบ `refunded` แล้ว (Medusa คืนเงินก่อน response ของ complete กลับ) */
export type MockPlaceOrderOptions = { refundedPollWhileFinishing?: boolean }

/** เวลาที่ค้าง placeOrder ไว้หลัง poll ตอบ refunded — พอให้ React render ผลของ poll ก่อน (ถ้ายังตัดสินจาก poll) */
const HOLD_AFTER_REFUNDED_POLL_MS = 1_500

/**
 * หลัง storefront สร้าง session ใหม่ (renewPromptPaySession — มี provider id ใน body) action ที่รับ cart id อย่างเดียว:
 * id ที่เห็นตอน QR แสดง = poll (ผ่านจริง นับไว้), id อื่น = placeOrder → ตอบเป็น `outcome`
 * `refundedPollWhileFinishing`: ระหว่างค้าง placeOrder poll ตอบ `refunded` (แทน `"pending"`) — ฉาก race ของ PAY-17
 */
export async function mockPlaceOrder(
  page: Page,
  ctx: Ctx,
  outcome: object,
  options: MockPlaceOrderOptions = {}
): Promise<Mocked> {
  const state = { renewed: false, pollActionIds: new Set<string>(), holding: false }
  const mocked: Mocked = { placeOrders: [], polls: [], refundedPolls: [] }
  let pollRefunded!: () => void
  const refundedPoll = new Promise<void>((resolve) => (pollRefunded = resolve))
  await page.route(
    (url) => url.pathname.includes("/checkout"),
    async (route: Route) => {
      const req = route.request()
      const actionId = req.headers()["next-action"]
      if (req.method() !== "POST" || !actionId) return route.fallback()
      const body = req.postData() ?? ""
      if (!isCartIdActionBody(body, ctx.cartId)) {
        if (body.includes(PROMPTPAY_PROVIDER)) state.renewed = true
        return route.fallback()
      }
      if (!state.renewed) {
        state.pollActionIds.add(actionId)
        return route.fallback()
      }
      if (state.pollActionIds.has(actionId)) {
        mocked.polls.push(Date.now())
        if (!state.holding) return route.fallback()
        const res = await route.fetch()
        const text = await res.text()
        expect(text, "action poll คืนสถานะ pending").toContain('"pending"')
        const headers = { ...res.headers() }
        delete headers["content-length"]
        await route.fulfill({ status: res.status(), headers, body: text.replace('"pending"', '"refunded"') })
        mocked.refundedPolls.push(Date.now())
        pollRefunded()
        return
      }
      mocked.placeOrders.push(Date.now())
      if (options.refundedPollWhileFinishing && mocked.placeOrders.length === 1) {
        state.holding = true
        await Promise.race([refundedPoll, new Promise((resolve) => setTimeout(resolve, 30_000))])
        await new Promise((resolve) => setTimeout(resolve, HOLD_AFTER_REFUNDED_POLL_MS))
        state.holding = false
      }
      const pollId = Array.from(state.pollActionIds)[0]
      const res = await route.fetch({
        headers: { ...req.headers(), "next-action": pollId },
        postData: JSON.stringify([ctx.cartId]),
      })
      const text = await res.text()
      expect(text, "action poll คืนสถานะ pending").toContain('"pending"')
      const headers = { ...res.headers() }
      delete headers["content-length"]
      await route.fulfill({ status: res.status(), headers, body: text.replace('"pending"', JSON.stringify(outcome)) })
    }
  )
  await expect.poll(() => state.pollActionIds.size, { timeout: 30_000 }).toBeGreaterThan(0)
  return mocked
}
