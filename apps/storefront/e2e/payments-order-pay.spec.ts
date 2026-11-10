import { APIRequestContext, BrowserContext, Page, Route } from "@playwright/test"

import { paymentSessionResult } from "../src/lib/util/action-result"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { GroupBuyOrderCtx, groupBuyOrder, leaveGroup } from "./support/group-buy"
import { createCustomer, signInAs, STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, PROMPTPAY_PROVIDER, authorizePromptPay, fillCard } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// PAY-3b1/PAY-3b2: spec 06 กฎข้อ 9, AC-19 (บัตร), AC-7 (พร้อมเพย์), AC-20 (กลับจาก redirect ของ Stripe) — หน้า /account/orders/:id/pay ของ draft order กลุ่ม (อ่านจาก GB-8)
// กรณี 409/400/500/401 ใช้ route mock ของ server action (ผลของการสร้าง session และ response ของ GB-8 ที่ browser ได้รับ)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-3b1" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response ของ GB-8 ที่ mock แก้บาง field
type Gb8 = any
type Payment = { payment_status?: string; collection?: string; session?: string }

const payPath = (orderId: string) => `/${CC}/account/orders/${orderId}/pay`

async function openPay(page: Page, context: BrowserContext, baseURL: string, ctx: GroupBuyOrderCtx, query = "") {
  await signInAs(context, baseURL, ctx.customer)
  return page.goto(payPath(ctx.orderId) + query)
}

/** query ที่ Stripe แนบมาตอน redirect กลับ (กฎข้อ 9 d3) */
const stripeReturnQuery = (status: string) => `?payment_intent=pi_x&payment_intent_client_secret=pi_x_secret&redirect_status=${status}`
const CAPTURED: Payment = { payment_status: "captured", collection: "completed", session: "authorized" }
const NOT_PAID: Payment = { payment_status: "not_paid", collection: "not_paid", session: "pending" }
/** ช่วงที่ processPaymentWorkflow ของ Medusa authorize แล้วแต่ยังไม่ capture (คนละ step) */
const AUTHORIZED: Payment = { payment_status: "authorized", collection: "authorized", session: "authorized" }
/** ไม่ poll ต่อ = ไม่มี GB-8 เพิ่มใน 2 รอบ poll (PROMPTPAY_POLL_MS = 3 วินาที) + ส่วนเผื่อ */
const NO_MORE_POLL_MS = 2 * 3_000 + 1_000

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
  /**
   * response ของ Medusa (`status` + `code`) ที่ createPaymentSession ได้ — action คืนผลผ่าน `paymentSessionResult` (CORE-4i-b);
   * ฟังก์ชัน = ผลของครั้งที่ n (undefined = ผลจริง)
   */
  create?: { status: number; code: string | null } | ((n: number) => { status: number; code: string | null } | undefined)
  /** mock `create` เฉพาะ n ครั้งแรก (ครั้งถัดไปใช้ผลจริง) */
  createTimes?: number
  /** response ของ GB-8 ครั้งที่ n (นับจากหลังสร้าง session หรือจากเปิดหน้าเมื่อ `fromStart`) */
  gb8?: (n: number, body: Gb8) => Gb8
  /** GB-8 ครั้งที่ n ตอบ 500 (อ่านล้ม) */
  gb8Fail?: (n: number) => boolean
  /** นับ/mock GB-8 ตั้งแต่เปิดหน้า (กลับจาก redirect — ยังไม่มีการสร้าง session) */
  fromStart?: boolean
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
        const result = typeof mock.create === "function" ? mock.create(log.created) : mock.create
        const mocked = result && log.created <= (mock.createTimes ?? Infinity)
        return mocked ? fulfillResult(route, () => paymentSessionResult(result)) : route.fallback()
      }
      if (!log.created && !mock.fromStart) return route.fallback()
      if (body === JSON.stringify([orderId])) {
        const n = ++log.gb8
        if (mock.gb8Fail?.(n)) return route.fulfill({ status: 500, body: "" })
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

/** id ของ PI ของ session พร้อมเพย์ที่ pending (หลังแสดง QR) */
async function promptPayIntentId(request: APIRequestContext, ctx: GroupBuyOrderCtx): Promise<string> {
  const session = (await gb8(request, ctx)).order.payment_collections[0].payment_sessions.find(
    (s: { provider_id: string; status: string }) => s.provider_id === PROMPTPAY_PROVIDER && s.status === "pending"
  )
  return session.data.id
}

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

  test("d2 ยังไม่ชำระแล้วคลิกบัตรอีกครั้ง → สร้าง session ใหม่ได้ (ฟอร์มเดิมให้ลองใหม่ — qa #189 D-1)", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    const option = page.getByTestId(`payment-option-${CARD_PROVIDER}`)
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    const log = await mockActions(page, ctx.orderId, {
      // ครั้งแรกล้ม (ไม่มี session จริงเหมือน Stripe ล่ม) ครั้งที่สองใช้ผลจริง
      create: { status: 500, code: "unknown_error" },
      createTimes: 1,
      beforeCreate: () => (log.created === 1 ? held : Promise.resolve()),
      gb8: (n, body) => {
        if (n > 1) return body
        withPayment(body, { payment_status: "not_paid", collection: "not_paid" }).order.payment_collections[0].payment_sessions = []
        return body
      },
    })
    await option.click()
    // ระหว่างส่ง ตัวเลือกบัตรถูก disable (กันกดซ้ำ)
    await expect(option).toHaveAttribute("aria-disabled", "true")
    release()
    await expect(page.getByTestId("order-pay-error")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toBeVisible()
    expect(log.created).toBe(1)

    await option.click()
    await expect.poll(() => log.created, { message: "คลิกบัตรอีกครั้งต้องสร้าง session ใหม่" }).toBe(2)
    if (HAS_STRIPE_UI) await expect(page.getByTestId("order-pay-card-button")).toBeVisible({ timeout: 30_000 })
  })

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

test.describe("หน้าชำระเงินของ order กลุ่ม — กลับจาก redirect ของ Stripe (กฎข้อ 9 d3, AC-20)", () => {
  test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-3b2" } })

  test("redirect_status=succeeded + GB-8 ยัง not_paid → poll GB-8 (ไม่มีฟอร์ม) จน order-pay-paid", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(90_000)
    const ctx = await groupBuyOrder(request, true)
    const log = await mockActions(page, ctx.orderId, {
      fromStart: true,
      gb8: (n, body) => withPayment(body, n === 1 ? NOT_PAID : CAPTURED),
    })
    await openPay(page, context, baseURL!, ctx, stripeReturnQuery("succeeded"))
    await expect(page.getByTestId("order-pay-awaiting")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toHaveCount(0)
    // review #189: ลบ query ของ Stripe ออกจาก URL
    await expect(page).toHaveURL((url) => !url.search.includes("redirect_status"))
    let formSeen = false
    await expect
      .poll(
        async () => {
          formSeen ||= (await page.getByTestId("order-pay-form").count()) > 0
          return page.getByTestId("order-pay-paid").count()
        },
        { timeout: 30_000, intervals: [250] }
      )
      .toBe(1)
    await expectThai(page, ["order-pay-paid"])
    expect(formSeen, "ไม่มี order-pay-form ระหว่างรอ").toBe(false)
    expect(log.gb8).toBeGreaterThanOrEqual(2)
    expect(log.gb8).toBeLessThanOrEqual(10)
    expect(log.created).toBe(0)
    expectNoCartComplete(log)
    await evidence("01-redirect-succeeded-paid")
  })

  test("redirect_status=failed → order-pay-error + ฟอร์ม แล้วลองใหม่สำเร็จ → order-pay-paid", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    const ctx = await groupBuyOrder(request, true)
    const log = await mockActions(page, ctx.orderId, {
      create: { status: 200, code: null },
      gb8: (_n, body) => withPayment(body, CAPTURED),
    })
    await openPay(page, context, baseURL!, ctx, stripeReturnQuery("failed"))
    await expect(page.getByTestId("order-pay-error")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toBeVisible()
    await expectThai(page, ["order-pay-error"])
    await expect(page).toHaveURL((url) => !url.search.includes("redirect_status"))
    await evidence("02-redirect-failed-error")

    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId("order-pay-error")).toHaveCount(0)
    expect(log.created).toBe(1)
  })

  test("d2 แล้วอ่าน GB-8 ล้ม (500) → order-pay-error ไม่ poll ต่อ; ลองใหม่ได้ 409 PAYMENT_ALREADY_COMPLETED → poll จน paid", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(90_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    const log = await mockActions(page, ctx.orderId, {
      create: (n) => (n === 1 ? { status: 500, code: "unknown_error" } : { status: 409, code: "PAYMENT_ALREADY_COMPLETED" }),
      gb8Fail: (n) => n === 1,
      gb8: (_n, body) => withPayment(body, CAPTURED),
    })
    const option = page.getByTestId(`payment-option-${CARD_PROVIDER}`)
    await option.click()
    await expect(page.getByTestId("order-pay-error")).toBeVisible()
    await expect(page.getByTestId("order-pay-form")).toBeVisible()
    await expectThai(page, ["order-pay-error"])
    await page.waitForTimeout(NO_MORE_POLL_MS)
    expect(log.gb8, "ไม่ poll ต่อหลังอ่าน GB-8 ล้ม").toBe(1)

    await option.click()
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 30_000 })
    expect(log.created).toBe(2)
    expect(log.gb8).toBeLessThanOrEqual(11)
    expectNoCartComplete(log)
  })
})

test.describe("หน้าชำระเงินของ order กลุ่ม — Stripe test mode (AC-19 บัตร, AC-7 พร้อมเพย์)", () => {
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

  test("พร้อมเพย์ → QR → authorize test payment → order-pay-paid และ captured (AC-7)", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(150_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await page.getByTestId("order-pay-promptpay-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
    await authorizePromptPay(context, request, await promptPayIntentId(request, ctx))
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })
    expect((await gb8(request, ctx)).order.payment_status).toBe("captured")
  })

  test("poll ระหว่างแสดง QR เจอ authorized ที่ยังไม่ captured → order-pay-awaiting แล้ว order-pay-paid (review #203 B2)", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(90_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx)
    // GB-8 ครั้งที่ 1 = อ่านหลังสร้าง session (จริง — ต้องมี session pending ให้แสดง QR) ครั้งที่ 2 = poll ระหว่าง QR เจอ authorized
    const log = await mockActions(page, ctx.orderId, {
      gb8: (n, body) => (n === 1 ? body : withPayment(body, n === 2 ? AUTHORIZED : CAPTURED)),
    })
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await page.getByTestId("order-pay-promptpay-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId("order-pay-awaiting")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 30_000 })
    expect(log.gb8).toBeGreaterThanOrEqual(3)
    expectNoCartComplete(log)
  })

  test("กลับจาก redirect ที่ failed แล้วลองใหม่ด้วยบัตร 4242 → order-pay-paid และ captured", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(150_000)
    const ctx = await groupBuyOrder(request, true)
    await openPay(page, context, baseURL!, ctx, stripeReturnQuery("failed"))
    await expect(page.getByTestId("order-pay-error")).toBeVisible()
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4242424242424242")
    await page.getByTestId("order-pay-card-button").click()
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })
    expect((await gb8(request, ctx)).order.payment_status).toBe("captured")
  })
})
