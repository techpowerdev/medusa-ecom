import { APIRequestContext, BrowserContext, Page, Route } from "@playwright/test"

import { expect } from "./fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./medusa"
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
 * `variant` (PAY-19): สร้าง cart ที่พร้อมจ่ายของ variant นี้ผ่าน Store API แล้วเข้าขั้น payment ตรง (แบบ pay-9) แทนการไล่ PDP ของ t-shirt
 * `customer` (PAY-19 Q-P15): ใช้ลูกค้าที่เตรียมไว้ (อีเมลที่ Stripe ส่งอีเมลขอบัญชีรับเงินคืนได้) แทนการสมัครใหม่
 */
export async function paidWhileQrShown(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  baseURL: string,
  watch: string[] = [],
  { variant, customer: given }: { variant?: string; customer?: Customer } = {}
): Promise<Ctx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = given ?? (await createCustomer(request, pk))
  await signInAs(context, baseURL, customer)
  const seen = await trackTestIds(page, ["promptpay-awaiting-order", "promptpay-expired", ...watch])

  await page.clock.install()
  if (variant) {
    const id = await cartReadyForPayment(request, pk, customer, { variant, quantity: 1 })
    await context.addCookies([{ name: "_medusa_cart_id", value: id, url: baseURL }])
    await page.goto(`/${CC}/checkout?step=payment`)
  } else {
    await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
  }
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

/**
 * PAY-17 (spec 06 กฎข้อ 19b): ฉาก race ที่เกิดได้จริง — Next ส่ง server action ทีละตัวตามคิว (`dispatchAction`/`runRemainingActions`)
 * poll (`getPromptPayState`) จึงตอบ `refunded` "ระหว่าง" placeOrder ไม่ได้ แต่ตอบได้ระหว่างที่ placeOrder รอคิวอยู่ (`finishing` = true แล้ว):
 * 1. placeOrder แรกของทางสำรอง (จาก awaitOrder) ตอบ `processing` → finish ได้ retry ทางสำรองยัง poll ต่อ
 * 2. poll A ตอบ `pending` แต่ค้าง response ไว้นานกว่า PROMPTPAY_POLL_MS → interval รอบถัดไปส่ง poll B เข้าคิวต่อหลัง A
 * 3. ปล่อย A → client ได้ `complete` → `finish()` ตั้ง finishing = true แล้ว placeOrder เข้าคิวต่อหลัง B
 * 4. B ตอบ `refunded` ขณะ finishing (โค้ดเดิม: stopRefunded ไม่รู้เหตุ → `promptpay-retry-button` โผล่) แล้ว placeOrder ตอบ `outcome`
 */
export type MockPlaceOrderOptions = { refundedPollWhileFinishing?: boolean }

/** ค้าง poll A นานกว่า PROMPTPAY_POLL_MS (3 วินาที) ให้ poll B เข้าคิวต่อหลัง A */
const HOLD_POLL_A_MS = 4_500

/** ตอบ action poll ของ cart ด้วยค่าจริงที่แทน `"pending"` ด้วย `replacement` (ค้าง `delayMs` ก่อนตอบ) */
async function fulfillPoll(route: Route, replacement: string, delayMs = 0) {
  const res = await route.fetch()
  const text = await res.text()
  expect(text, "action poll คืนสถานะ pending").toContain('"pending"')
  const headers = { ...res.headers() }
  delete headers["content-length"]
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
  await route.fulfill({ status: res.status(), headers, body: text.replace('"pending"', replacement) })
}

/**
 * หลัง storefront สร้าง session ใหม่ (renewPromptPaySession — มี provider id ใน body) action ที่รับ cart id อย่างเดียว:
 * id ที่เห็นตอน QR แสดง = poll (ผ่านจริง นับไว้), id อื่น = placeOrder → ตอบเป็น `outcome`
 * `refundedPollWhileFinishing`: ลำดับของ MockPlaceOrderOptions (placeOrder แรกตอบ `processing`, ตัวที่สองตอบ `outcome`)
 */
export async function mockPlaceOrder(
  page: Page,
  ctx: Ctx,
  outcome: object,
  options: MockPlaceOrderOptions = {}
): Promise<Mocked> {
  const state = { renewed: false, pollActionIds: new Set<string>(), racePolls: 0 }
  const mocked: Mocked = { placeOrders: [], polls: [], refundedPolls: [] }
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
        // race: เฉพาะ poll หลัง placeOrder แรก และก่อน placeOrder ที่สอง
        if (!options.refundedPollWhileFinishing || mocked.placeOrders.length !== 1) return route.fallback()
        state.racePolls++
        if (state.racePolls === 1) return fulfillPoll(route, '"pending"', HOLD_POLL_A_MS)
        if (state.racePolls === 2) {
          // เวลาที่ request ของ B มาถึง — placeOrder ที่สองต้องมาหลังจากนี้ (รอคิวหลัง B)
          mocked.refundedPolls.push(Date.now())
          return fulfillPoll(route, '"refunded"')
        }
        return route.fallback()
      }
      mocked.placeOrders.push(Date.now())
      const answer = options.refundedPollWhileFinishing && mocked.placeOrders.length === 1 ? { kind: "processing" } : outcome
      const pollId = Array.from(state.pollActionIds)[0]
      const res = await route.fetch({
        headers: { ...req.headers(), "next-action": pollId },
        postData: JSON.stringify([ctx.cartId]),
      })
      const text = await res.text()
      expect(text, "action poll คืนสถานะ pending").toContain('"pending"')
      const headers = { ...res.headers() }
      delete headers["content-length"]
      await route.fulfill({ status: res.status(), headers, body: text.replace('"pending"', JSON.stringify(answer)) })
    }
  )
  await expect.poll(() => state.pollActionIds.size, { timeout: 30_000 }).toBeGreaterThan(0)
  return mocked
}
