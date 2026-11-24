import { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders, ok, placeOrder } from "./support/medusa"
import { Ctx, paidWhileQrShown } from "./support/promptpay-race"
import { HAS_STRIPE_UI, PROMPTPAY_PROVIDER, STRIPE_SECRET, cartPaymentState, continueToReview } from "./support/stripe"
import { WorkflowExecution, cartCompletionSettled } from "./support/cart-completion"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import { expectThai } from "./support/thai-text"

// PAY-19 (spec 06 กฎข้อ 21, AC-32 — owner Q-P13 = ก 2026-11-24): Medusa คืนเงินแล้วสร้าง session ใหม่ไม่สำเร็จ → collection ไม่มี session
// ขั้น review (PaymentButton) จึงแสดง notice คืนเงิน + ลิงก์ตะกร้าแทนปุ่ม disabled "กรุณาเลือกวิธีชำระเงิน" — หลัง router.refresh, reload และ Back
// ฉากจริง (ไม่ใช่ route mock — cart อ่านฝั่ง server): ชำระพร้อมเพย์ตอน QR แสดง (webhook ไม่มา) แล้วใช้สิทธิ์ flash จาก cart อื่นผ่าน API
// → QR ครบ 10 นาที → guard ตอบ PAYMENT_ALREADY_COMPLETED → ทางสำรอง placeOrder จริงล้ม FLASH_LIMIT_EXCEEDED → Medusa คืนเงิน
// Stripe test mode จริง; สินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-19" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"
const NOTICE = "review-refunded-notice"
const GO_TO_CART = "review-refunded-go-to-cart"

/** flash config ของแคมเปญ: สิทธิ์ต่อคน `perCustomerLimit` ชิ้น (total_cap 50) */
const flashConfig = (perCustomerLimit: number) => ({ per_customer_limit: perCustomerLimit, total_cap: 50, show_countdown: true })

let admin: Headers
let variantId: string
let campaignId: string

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)
  admin = await adminHeaders(request)
  const product = await createFlashProduct(request, admin, "PAY19", 100)
  variantId = product.variantId
  campaignId = await createFlashCampaign(request, admin, "PAY19", product.productId, flashConfig(1))
})

test.afterAll(async ({ request }) => {
  if (campaignId) await endFlashCampaign(request, admin, campaignId)
})

type CollectionState = { id?: string; captured: number; refunded: number; sessions: number; completed: boolean }

/** payment collection ของ cart ผ่าน Store API ด้วย field ชุดเดียวกับหน้า checkout (default `*payment_collection` — กฎข้อ 21d) */
async function collectionOf(request: APIRequestContext, ctx: Ctx): Promise<CollectionState> {
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${ctx.cartId}`, {
      headers: { authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk },
    }),
    "retrieve cart"
  )
  const pc = cart.payment_collection
  return {
    id: pc?.id,
    captured: Number(pc?.captured_amount ?? 0),
    refunded: Number(pc?.refunded_amount ?? 0),
    sessions: pc?.payment_sessions?.length ?? 0,
    completed: !!cart.completed_at,
  }
}

/**
 * D-1 (qa/review #548 — owner Q-P14 = ข): หลักฐานว่าทำไม `refunded_amount` ของ collection เป็น 0 — พิมพ์ลง stdout ของ CI เสมอ
 * payment + captures/refunds ของ Medusa (Admin API — refund ที่ provider ล้มถูก soft-delete จึงไม่เห็นที่นี่),
 * collection ของ cart และ refund ฝั่ง Stripe ของ PaymentIntent (status/failure_reason — key ของ CI เท่านั้น แบบ pay-9)
 */
async function logRefundEvidence(request: APIRequestContext, ctx: Ctx, sessionId: string) {
  const payments = await request.get(
    `${BACKEND_URL}/admin/payments?payment_session_id=${sessionId}&fields=id,amount,captured_at,canceled_at,*captures,*refunds`,
    { headers: ctx.admin }
  )
  const cart = await request.get(
    `${BACKEND_URL}/store/carts/${ctx.cartId}?fields=id,completed_at,payment_collection.id,payment_collection.status,` +
      "payment_collection.captured_amount,payment_collection.refunded_amount,*payment_collection.payment_sessions",
    { headers: { authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk } }
  )
  const refunds = await request.get(`https://api.stripe.com/v1/refunds?payment_intent=${ctx.intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  const stripeRefunds = refunds.ok()
    ? ((await refunds.json()).data as Record<string, unknown>[]).map((r) => ({
        id: r.id,
        status: r.status,
        amount: r.amount,
        failure_reason: r.failure_reason,
        next_action: r.next_action,
        destination_details: r.destination_details,
      }))
    : { status: refunds.status(), body: await refunds.text() }
  console.log(
    "PAY-19 D-1 evidence",
    JSON.stringify(
      {
        intent: ctx.intentId,
        session: sessionId,
        payments: payments.ok() ? (await payments.json()).payments : { status: payments.status() },
        cart: cart.ok() ? (await cart.json()).cart : { status: cart.status() },
        stripe_refunds: stripeRefunds,
      },
      null,
      2
    )
  )
}

/** notice คืนเงินของขั้น review: เห็นข้อความไทย + ลิงก์ไป /th/cart และไม่มีปุ่มจ่าย/เริ่มชำระใหม่ */
async function expectRefundedReview(page: Page) {
  await expect(page.getByTestId(NOTICE)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId(NOTICE)).toContainText("คืนเงิน")
  await expect(page.getByTestId(GO_TO_CART)).toHaveAttribute("href", new RegExp(`/${CC}/cart$`))
  await expectThai(page, [NOTICE, GO_TO_CART])
  await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
  await expect(page.getByTestId("promptpay-retry-button")).toHaveCount(0)
}

test("AC-32: PromptPay ถูกคืนเงินจริง → ขั้น review แสดง notice + ลิงก์ตะกร้าหลัง refresh, reload และ Back; เลือกวิธีชำระใหม่แล้วจ่ายได้", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(300_000)
  let ctx!: Ctx
  let firstCollection: string | undefined
  let sessionId = ""
  // ขอบล่างของ execution ที่อ่าน (เผื่อนาฬิกา DB/runner ต่างกัน)
  const startedAt = new Date(Date.now() - 60_000).toISOString()

  await step("Given ชำระพร้อมเพย์ตอน QR แสดง (webhook ไม่มา) แล้วลูกค้าใช้สิทธิ์ flash จาก cart อื่นผ่าน API", async () => {
    ctx = await paidWhileQrShown(page, context, request, baseURL!, [], variantId)
    firstCollection = (await collectionOf(request, ctx)).id
    const { sessions } = await cartPaymentState(request, ctx.pk, ctx.customer, ctx.cartId)
    sessionId = sessions.find((s) => s.provider_id === PROMPTPAY_PROVIDER)?.id ?? ""
    expect(sessionId, "session พร้อมเพย์ที่จ่ายแล้ว").toBeTruthy()
    expect(firstCollection, "payment collection แรกของ cart").toBeTruthy()
    await placeOrder(request, ctx.pk, ctx.customer, { variant: variantId, quantity: 1 })
  })

  await step("When QR ครบ 10 นาที → ทางสำรองล้ม FLASH_LIMIT_EXCEEDED จริง → Medusa คืนเงิน (collection ไม่มี session)", async () => {
    await page.clock.fastForward("10:01")
    const executions = async (): Promise<WorkflowExecution[]> =>
      (
        await ok(
          await request.get(
            `${BACKEND_URL}/admin/workflows-executions?workflow_id=complete-cart&fields=id,state,context` +
              `&created_at[$gte]=${encodeURIComponent(startedAt)}`,
            { headers: ctx.admin }
          ),
          "admin workflow executions"
        )
      ).workflow_executions
    await expect.poll(async () => cartCompletionSettled(await executions(), ctx.cartId), { timeout: 90_000 }).toBe(true)
    await logRefundEvidence(request, ctx, sessionId)
    const state = await collectionOf(request, ctx)
    expect(state.completed).toBe(false)
    expect(state.captured).toBeGreaterThan(0)
    expect(state.refunded).toBeGreaterThanOrEqual(state.captured)
    expect(state.sessions, "Medusa สร้าง session ใหม่หลังคืนเงินไม่สำเร็จ (Q-P13)").toBe(0)
  })

  await step("Then หลัง router.refresh ขั้น review แสดง notice คืนเงิน + ลิงก์ตะกร้า (ไม่ใช่ปุ่ม disabled)", async () => {
    await expectRefundedReview(page)
    await evidence("01-review-refunded-after-refresh")
  })

  await step("(a) reload → ยังเห็น notice + ลิงก์ตะกร้า ไม่มีปุ่มจ่าย", async () => {
    await page.reload()
    await expect(page).toHaveURL(/[?&]step=review(&|$)/)
    await expectRefundedReview(page)
    await evidence("02-review-refunded-after-reload")
  })

  await step("(b) คลิกไปที่ตะกร้า แล้วกด Back → เหมือน (a)", async () => {
    await page.getByTestId(GO_TO_CART).click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/cart(\\?.*)?$`), { timeout: 30_000 })
    await page.goBack()
    await expect(page).toHaveURL(/[?&]step=review(&|$)/, { timeout: 30_000 })
    await expectRefundedReview(page)
  })

  await step("(c) admin เพิ่มสิทธิ์ → ขั้น payment เลือกพร้อมเพย์ → collection ใหม่ และขั้น review มีปุ่มจ่าย", async () => {
    await ok(
      await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, { headers: admin, data: flashConfig(2) }),
      "flash sale config"
    )
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await continueToReview(page)
    await expect(page.getByTestId("submit-order-button")).toBeEnabled()
    await expect(page.getByTestId(NOTICE)).toHaveCount(0)
    const state = await collectionOf(request, ctx)
    expect(state.id, "PAY-9 สร้าง payment collection ใหม่").not.toBe(firstCollection)
    expect(state.captured).toBe(0)
    await evidence("03-review-new-collection")
  })
})
