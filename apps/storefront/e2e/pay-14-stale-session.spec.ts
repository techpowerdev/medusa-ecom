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
import { isCartIdActionBody } from "./support/server-action"
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
  // train #483 (run 44993099572): หน้าแรกยังตรวจ PI นี้อยู่ (props ได้ session หลัง backend) — ถ้ายกเลิกก่อนหน้านั้นตรวจเสร็จ
  // หน้าแรกจะสร้าง session ใหม่เองโดยไม่ผ่าน route mock แล้วหน้าที่เปิดใหม่ได้ PI ที่ยังใช้ได้ → ปิดหน้าก่อนยกเลิก PI
  await page.goto("about:blank")
  await cancelIntent(request, staleIntent)
  expect((await retrievePaymentIntent(request, staleIntent)).status).toBe("canceled")
  // cart ยังชี้ PI ที่ยกเลิกแล้ว (ไม่มีหน้าใดสร้าง session ใหม่ระหว่างทาง)
  expect(await hasNewIntent(request, customer, cartId, staleIntent)()).toBe(false)
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

// PAY-16 (spec 06 กฎข้อ 18, AC-29): สถานะขั้น payment หลังเจอ session ที่ชี้ PI ที่จบแล้ว — ฉากเดียวกับ AC-27 (Stripe test mode จริง)
// + route mock ผลของ server action: ผลของ action สร้าง session ส่งต่อด้วย provider ที่ไม่มีจริง (backend ตอบ error ก่อนแตะ session — ไม่มีผลข้างเคียง)
// แล้วแทน `"error":"failed"` ใน payload (แบบ CORE-76) — cart ใน props จึงยังชี้ PI เดิมเสมอ
const MANUAL = "pp_system_default"
const FAILED = '"error":"failed"'

type CardActions = { calls: number }

/** action สร้าง session ของบัตร: ครั้งที่ n (นับจาก 1) ใช้ `plan(n)` — "fail" = 500, string = แทนผลด้วยค่านั้น, undefined = ผ่านจริง */
async function mockCardSessions(page: Page, plan: (n: number) => "fail" | string | undefined): Promise<CardActions> {
  const seen: CardActions = { calls: 0 }
  await page.route(`**/${CC}/checkout**`, async (route) => {
    const req = route.request()
    if (!isCardSessionAction(req)) return route.fallback()
    const action = plan(++seen.calls)
    if (action === undefined) return route.fallback()
    if (action === "fail") return route.fulfill({ status: 500, body: "" })
    const response = await route.fetch({ postData: (req.postData() ?? "").replaceAll(CARD_PROVIDER, "pp_pay16_missing") })
    const text = await response.text()
    expect(text, "action สร้าง session ด้วย provider ที่ไม่มีจริงคืน failed").toContain(FAILED)
    return route.fulfill({ response, body: text.replace(FAILED, action) })
  })
  return seen
}

test.describe("PAY-16 (AC-29)", () => {
  test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-16" } })

  test("AC-29 a: notice แล้วเลือก manual → notice และปุ่มลองอีกครั้งหาย ไม่สร้าง session ของบัตรเพิ่ม", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const customer = await createCustomer(request, pk)
    await cartWithStaleCardSession(page, context, request, baseURL!, customer)
    const actions = await mockCardSessions(page, () => "fail")

    await step("สร้างอัตโนมัติล้ม → payment-session-reset-notice", async () => {
      await page.goto(`/${CC}/checkout?step=payment`)
      await expect(page.getByTestId("payment-session-reset-notice")).toBeVisible({ timeout: 10_000 })
      expect(actions.calls).toBe(1)
    })

    await step("เลือก manual → notice หาย ไม่มีปุ่มลองอีกครั้ง และไม่มี action สร้าง session ของบัตร", async () => {
      await page.getByTestId(`payment-option-${MANUAL}`).click()
      await expect(page.getByTestId("payment-session-reset-notice")).toHaveCount(0)
      await expect(page.getByTestId("payment-session-retry")).toHaveCount(0)
      await expect(page.getByTestId("submit-payment-button")).toBeEnabled()
      expect(actions.calls).toBe(1)
      await evidence("01-notice-gone-after-manual")
    })
  })

  test("AC-29 b: dblclick ปุ่มลองอีกครั้ง → สร้าง session 1 ครั้ง แล้วได้ PI ใหม่", async ({ page, context, request, baseURL, step }) => {
    test.setTimeout(120_000)
    const customer = await createCustomer(request, pk)
    const { cartId, staleIntent } = await cartWithStaleCardSession(page, context, request, baseURL!, customer)
    const actions = await mockCardSessions(page, (n) => (n === 1 ? "fail" : undefined))

    await step("notice ขึ้นหลังสร้างอัตโนมัติล้ม แล้ว dblclick payment-session-retry", async () => {
      await page.goto(`/${CC}/checkout?step=payment`)
      await page.getByTestId("payment-session-retry").dblclick({ timeout: 10_000 })
    })

    await step("action สร้าง session หลัง notice = 1 ครั้ง และ cart ได้ PI ใหม่", async () => {
      await expect.poll(hasNewIntent(request, customer, cartId, staleIntent), { timeout: 15_000 }).toBe(true)
      await fillCard(page, "4242424242424242")
      expect(actions.calls).toBe(2)
    })
  })

  test("AC-29 c: สร้าง session ใหม่ 'สำเร็จ' แต่ cart ไม่ได้ session ใหม่ → ภายใน 12 วินาทีเห็น notice ไม่เห็น skeleton", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const customer = await createCustomer(request, pk)
    await cartWithStaleCardSession(page, context, request, baseURL!, customer)
    const actions = await mockCardSessions(page, () => '"ok":true')

    await step("เปิดขั้น payment → renew อัตโนมัติ 'สำเร็จ' ระหว่างรอเห็น skeleton ของช่องบัตร", async () => {
      await page.goto(`/${CC}/checkout?step=payment`)
      await expect.poll(() => actions.calls, { timeout: 10_000 }).toBe(1)
      await expect(page.getByTestId("skeleton-card-details")).toBeVisible()
    })

    await step("ภายใน 12 วินาที → notice ไทย และไม่มี skeleton ค้าง", async () => {
      const notice = page.getByTestId("payment-session-reset-notice")
      await expect(notice).toBeVisible({ timeout: 12_000 })
      await expect(notice).toHaveText(THAI)
      await expect(page.getByTestId("skeleton-card-details")).toHaveCount(0)
      expect(actions.calls).toBe(1)
      await expectNoStripeEnglish(page)
      await evidence("02-notice-without-skeleton")
    })
  })

  test("AC-29 d: PAYMENT_ALREADY_COMPLETED → ระหว่างรอ order radio วิธีชำระ disabled", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const customer = await createCustomer(request, pk)
    const { cartId } = await cartWithStaleCardSession(page, context, request, baseURL!, customer)
    await mockCardSessions(page, () => '"error":"PAYMENT_ALREADY_COMPLETED"')
    // placeOrder ของการรอ order: ส่งต่อด้วย cart id ที่ไม่มีจริง (`kind: failed`) แล้วแทนเป็น processing = รอ order ต่อ (แบบ CORE-76)
    const placeOrders = { calls: 0 }
    await page.route(`**/${CC}/checkout**`, async (route) => {
      const req = route.request()
      const body = req.postData() ?? ""
      // placeOrder(cart.id, undefined, countryCode) — body มี country code ด้วย
      const isPlaceOrder = isCartIdActionBody(body, cartId) && body.includes(`"${CC}"`)
      if (req.method() !== "POST" || !req.headers()["next-action"] || !isPlaceOrder) return route.fallback()
      placeOrders.calls++
      const response = await route.fetch({ postData: body.replaceAll(cartId, "cart_pay16_missing") })
      const text = await response.text()
      expect(text).toContain('"kind":"failed"')
      return route.fulfill({ response, body: text.replace('"kind":"failed"', '"kind":"processing"') })
    })

    await step("เปิดขั้น payment → backend ตอบชำระแล้ว → รอ order (processing) และ radio ทุกตัว disabled", async () => {
      await page.goto(`/${CC}/checkout?step=payment`)
      await expect(page.getByTestId("checkout-processing-notice")).toBeVisible({ timeout: 15_000 })
      expect(placeOrders.calls).toBeGreaterThan(0)
      await expect(page.getByTestId(`payment-option-${CARD_PROVIDER}`)).toBeDisabled()
      await expect(page.getByTestId(`payment-option-${MANUAL}`)).toBeDisabled()
      await evidence("03-radio-disabled-awaiting-order")
    })
  })
})
