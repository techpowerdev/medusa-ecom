import { APIRequestContext, BrowserContext, Page, Route } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { GroupBuyOrderCtx, groupBuyOrder, leaveGroup } from "./support/group-buy"
import { createCustomer, signInAs, STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, fillCard } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// PAY-3b1: spec 06 กฎข้อ 9, AC-19 (บัตร; พร้อมเพย์/AC-7 = PAY-3b2) — หน้า /account/orders/:id/pay ของ draft order กลุ่ม (อ่านจาก GB-8)
// กรณี 409/400/500/401 ใช้ route mock ของ server action (ผลของการสร้าง session และ response ของ GB-8 ที่ browser ได้รับ)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-3b1" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response ของ GB-8 ที่ mock แก้บาง field
type Gb8 = any
type Payment = { payment_status?: string; collection?: string; session?: string }

const payPath = (orderId: string) => `/${CC}/account/orders/${orderId}/pay`

async function openPay(page: Page, context: BrowserContext, baseURL: string, ctx: GroupBuyOrderCtx) {
  await signInAs(context, baseURL, ctx.customer)
  return page.goto(payPath(ctx.orderId))
}

/** แก้สถานะการชำระใน response ของ GB-8 (collection แรก) */
function withPayment(body: Gb8, { payment_status, collection, session }: Payment): Gb8 {
  const pc = body.order.payment_collections[0]
  if (payment_status) body.order.payment_status = payment_status
  if (collection) pc.status = collection
  if (session) {
    // คง session จริง (มี client_secret เมื่อ CI มี Stripe key — StripeWrapper ต้องใช้) เปลี่ยนแค่ status; ไม่มี session จริงจึงสร้างแทน
    pc.payment_sessions = pc.payment_sessions.length
      ? pc.payment_sessions.map((s: Gb8) => ({ ...s, status: session }))
      : [{ id: "payses_mock", provider_id: CARD_PROVIDER, status: session, amount: pc.amount, data: {} }]
  }
  return body
}

/** แทนผลของ server action (บรรทัด `<id>:{...}` สุดท้ายของ RSC payload) ด้วยค่าที่ `fn` คืน */
async function fulfillResult(route: Route, fn: (result: Gb8) => Gb8) {
  const res = await route.fetch()
  const lines = (await res.text()).split("\n")
  const i = lines.findLastIndex((l) => /^\w+:\{/.test(l))
  const sep = lines[i].indexOf(":")
  lines[i] = `${lines[i].slice(0, sep)}:${JSON.stringify(fn(JSON.parse(lines[i].slice(sep + 1))))}`
  const headers = { ...res.headers() }
  delete headers["content-length"]
  await route.fulfill({ status: res.status(), headers, body: lines.join("\n") })
}

type Mock = {
  /** ผลของ createPaymentSession (`status` ของ Medusa + `code`) */
  create?: { status: number; code: string | null }
  /** response ของ GB-8 ครั้งที่ n (นับจากหลังสร้าง session) */
  gb8?: (n: number, body: Gb8) => Gb8
  /** ก่อนตอบผลการสร้าง session (เช่น ล้าง cookie = token หมดอายุ) */
  beforeCreate?: () => Promise<void>
}

/** ดัก server action ของหน้า pay: สร้าง session (body มี pay_col_) / อ่าน GB-8 (body = [order id]) / action อื่น */
async function mockActions(page: Page, orderId: string, mock: Mock) {
  const log = { created: 0, gb8: 0, other: [] as string[] }
  await page.route(
    (url) => url.pathname === payPath(orderId),
    async (route) => {
      const req = route.request()
      if (req.method() !== "POST" || !req.headers()["next-action"]) return route.fallback()
      const body = req.postData() ?? ""
      if (body.includes("pay_col_")) {
        log.created++
        await mock.beforeCreate?.()
        return mock.create ? fulfillResult(route, () => mock.create) : route.fallback()
      }
      if (!log.created) return route.fallback()
      if (body === JSON.stringify([orderId])) {
        const n = ++log.gb8
        return mock.gb8 ? fulfillResult(route, (r) => mock.gb8!(n, r)) : route.fallback()
      }
      log.other.push(body)
      return route.fallback()
    }
  )
  return log
}

/** ไม่มี action ที่ส่ง cart id (complete cart / placeOrder) — ข้อ d/d2 อ่าน GB-8 อย่างเดียว */
const expectNoCartComplete = (log: { other: string[] }) =>
  expect(log.other.filter((b) => b.includes("cart_"))).toEqual([])

async function gb8(request: APIRequestContext, ctx: GroupBuyOrderCtx): Promise<Gb8> {
  const res = await request.get(`${BACKEND_URL}/store/customers/me/group-buy/orders/${ctx.orderId}`, {
    headers: { authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk },
  })
  expect(res.status()).toBe(200)
  return res.json()
}

test.describe("หน้าชำระเงินของ order กลุ่ม — สถานะ (AC-19)", () => {
  test("B เปิด URL ของ A → HTTP 404; A เห็นฟอร์มชำระเงิน", async ({ page, context, request, baseURL, step, evidence }) => {
    const ctx = await groupBuyOrder(request, true)
    await step("B → 404", async () => {
      const b = await createCustomer(request, ctx.pk)
      await signInAs(context, baseURL!, b)
      expect((await page.goto(payPath(ctx.orderId)))?.status()).toBe(404)
    })
    await step("A → order-pay-form + วิธีชำระบัตร", async () => {
      await context.clearCookies()
      expect((await openPay(page, context, baseURL!, ctx))?.status()).toBe(200)
      await expect(page.getByTestId("order-pay-form")).toBeVisible()
      await expect(page.getByTestId(`payment-option-${CARD_PROVIDER}`)).toBeVisible()
      await evidence("01-order-pay-form")
    })
  })

  test("joined → order-pay-waiting; cancelled → order-pay-closed (ไม่มีฟอร์ม)", async ({ page, context, request, baseURL }) => {
    const ctx = await groupBuyOrder(request, false)
    await openPay(page, context, baseURL!, ctx)
    await expect(page.getByTestId("order-pay-waiting")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toHaveCount(0)
    await expectThai(page, ["order-pay-waiting"])

    await leaveGroup(request, ctx)
    await page.reload()
    await expect(page.getByTestId("order-pay-closed")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toHaveCount(0)
    await expectThai(page, ["order-pay-closed"])
  })

  test("เลย pay_deadline_at → order-pay-closed", async ({ page, context, request, baseURL }) => {
    const ctx = await groupBuyOrder(request, true)
    const { group } = await gb8(request, ctx)
    await page.clock.install({ time: Date.parse(group.pay_deadline_at) + 60_000 })
    await openPay(page, context, baseURL!, ctx)
    await expect(page.getByTestId("order-pay-closed")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toHaveCount(0)
    await expectThai(page, ["order-pay-closed"])
  })
})

test.describe("หน้าชำระเงินของ order กลุ่ม — สร้าง session ไม่สำเร็จ (กฎข้อ 9 d/d2, AC-19)", () => {
  test("409 PAYMENT_ALREADY_COMPLETED → poll GB-8 อย่างเดียว ≤ 10 ครั้ง แล้ว promptpay-order-delayed", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    const log = await mockActions(page, ctx.orderId, {
      create: { status: 409, code: "PAYMENT_ALREADY_COMPLETED" },
      gb8: (_n, body) => withPayment(body, { session: "authorized" }),
    })
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await expect(page.getByTestId("order-pay-awaiting")).toBeVisible()
    await expect(page.getByTestId("promptpay-order-delayed")).toBeVisible({ timeout: 60_000 })
    await expectThai(page, ["promptpay-order-delayed"])
    expect(log.gb8).toBe(10)
    await page.waitForTimeout(7_000)
    expect(log.gb8, "หยุดยิงหลังครบเพดาน").toBe(10)
    expectNoCartComplete(log)
  })

  for (const [status, code, first] of [
    [500, "unknown_error", { payment_status: "not_paid", session: "authorized" }],
    [400, "invalid_data", { payment_status: "authorized" }],
  ] as const) {
    test(`${status} ${code} + GB-8 มีการชำระแล้ว → poll จน captured แล้ว order-pay-paid (ไม่มี error)`, async ({
      page,
      context,
      request,
      baseURL,
      evidence,
    }) => {
      test.setTimeout(90_000)
      const ctx = await groupBuyOrder(request, true)
      await openPay(page, context, baseURL!, ctx)
      const log = await mockActions(page, ctx.orderId, {
        create: { status, code },
        // ครั้งแรก (อ่านหลัง error) ยังไม่ captured; ครั้งถัดไป captured (review #184: หยุดเมื่อ captured เท่านั้น)
        gb8: (n, body) =>
          withPayment(body, n === 1 ? first : { payment_status: "captured", collection: "completed", session: "authorized" }),
      })
      await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
      await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId("order-pay-error")).toHaveCount(0)
      await expectThai(page, ["order-pay-paid"])
      expect(log.gb8).toBeGreaterThanOrEqual(2)
      expect(log.gb8).toBeLessThanOrEqual(10)
      expectNoCartComplete(log)
      if (status === 500) await evidence("02-order-pay-paid-after-race")
    })
  }

  for (const [status, code] of [
    [500, "unknown_error"],
    [400, "invalid_data"],
    [409, "invalid_state_error"],
  ] as const) {
    test(`${status} ${code} + GB-8 ยังไม่ชำระ → order-pay-error + ฟอร์มเดิม, อ่าน GB-8 1 ครั้ง`, async ({
      page,
      context,
      request,
      baseURL,
      evidence,
    }) => {
      const ctx = await groupBuyOrder(request, true)
      await openPay(page, context, baseURL!, ctx)
      const log = await mockActions(page, ctx.orderId, {
        create: { status, code },
        gb8: (_n, body) => withPayment(body, { payment_status: "not_paid", collection: "not_paid", session: "pending" }),
      })
      await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
      await expect(page.getByTestId("order-pay-error")).toBeVisible()
      await expect(page.getByTestId("order-pay-form")).toBeVisible()
      await expectThai(page, ["order-pay-error"])
      await page.waitForTimeout(7_000)
      expect(log.gb8, "ไม่ poll ต่อ").toBe(1)
      expectNoCartComplete(log)
      if (status === 500) await evidence("03-order-pay-error")
    })
  }

  test("401 → หน้า login และไม่อ่าน GB-8 จาก d2", async ({ page, context, request, baseURL }) => {
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    const log = await mockActions(page, ctx.orderId, {
      create: { status: 401, code: "unauthorized" },
      // token หมดอายุ: cookie ถูกล้างก่อน storefront ได้ผล 401
      beforeCreate: () => context.clearCookies(),
    })
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await expect(page.getByTestId("login-page")).toBeVisible()
    await page.waitForTimeout(3_000)
    expect(log.gb8).toBe(0)
  })
})

test.describe("หน้าชำระเงินของ order กลุ่ม — Stripe test mode (AC-19 บัตร; AC-7 พร้อมเพย์อยู่ใน PAY-3b2)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("บัตร 4242 → order-pay-paid ภายใน 60 วินาที และ payment captured", async ({ page, context, request, baseURL }) => {
    test.setTimeout(150_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4242424242424242")
    await page.getByTestId("order-pay-card-button").click()
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })
    expect((await gb8(request, ctx)).order.payment_status).toBe("captured")
  })
})
