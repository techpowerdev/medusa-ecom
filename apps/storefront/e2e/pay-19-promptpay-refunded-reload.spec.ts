import { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import crypto from "node:crypto"

import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  ok,
  placeOrder,
  publishableKey,
} from "./support/medusa"
import { Ctx, paidWhileQrShown } from "./support/promptpay-race"
import { HAS_STRIPE_UI, PROMPTPAY_PROVIDER, STRIPE_SECRET, continueToReview } from "./support/stripe"
import { WorkflowExecution, cartCompletionSettled } from "./support/cart-completion"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import { expectThai } from "./support/thai-text"

// PAY-19 (spec 06 กฎข้อ 21, AC-32 — owner Q-P13 = ก 2026-11-24): Medusa คืนเงินแล้วสร้าง session ใหม่ไม่สำเร็จ → collection ไม่มี session
// ขั้น review (PaymentButton) จึงแสดง notice คืนเงิน + ลิงก์ตะกร้าแทนปุ่ม disabled "กรุณาเลือกวิธีชำระเงิน" — หลัง router.refresh, reload และ Back
// ฉากจริง (ไม่ใช่ route mock — cart อ่านฝั่ง server): ชำระพร้อมเพย์ตอน QR แสดง (webhook ไม่มา) แล้วใช้สิทธิ์ flash จาก cart อื่นผ่าน API
// → QR ครบ 10 นาที → guard ตอบ PAYMENT_ALREADY_COMPLETED → ทางสำรอง placeOrder จริงล้ม FLASH_LIMIT_EXCEEDED → Medusa คืนเงิน
// Stripe test mode จริง; สินค้า/แคมเปญเฉพาะของ test นี้และปิดแคมเปญเมื่อจบ; หา element ด้วย data-testid (ADR-014)
// Q-P15 (owner 2026-11-24): refund พร้อมเพย์ของ Stripe ส่งอีเมลขอบัญชีรับเงินคืน — บัญชี test ส่งได้เฉพาะอีเมลของบัญชี
// → ลูกค้าของ test ใช้อีเมลจาก secret `E2E_PROMPTPAY_REFUND_EMAIL` (ไม่ตั้ง = skip); repo public: ไม่ log อีเมล,
// ปิด trace (DOM/network มีอีเมล) และซ่อนกล่องข้อมูลติดต่อใน screenshot
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-19" }, trace: "off" })

const REFUND_EMAIL = process.env.E2E_PROMPTPAY_REFUND_EMAIL ?? ""
const NEED_EMAIL = "ต้องตั้ง E2E_PROMPTPAY_REFUND_EMAIL (อีเมลของบัญชี Stripe test — refund พร้อมเพย์ส่งอีเมลขอบัญชีรับเงินคืน)"
/** กล่องที่แสดงอีเมลของ cart ในหน้า checkout (addresses) */
const CONTACT_SELECTORS = ['[data-testid="billing-contact-summary"]', '[data-testid="shipping-contact-summary"]', '[data-testid="shipping-email-input"]']

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
  test.skip(!REFUND_EMAIL, NEED_EMAIL)
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
 * ลูกค้าที่อีเมล = `REFUND_EMAIL` (อีเมลซ้ำได้ครั้งเดียวต่อ DB): รหัสผ่านได้จากอีเมล (DB ของ test เท่านั้น) → สมัครไม่ได้เพราะมีแล้ว = login
 */
async function refundEmailCustomer(request: APIRequestContext, pk: string): Promise<Customer> {
  const email = REFUND_EMAIL
  const password = crypto.createHash("sha256").update(`pay-19:${email}`).digest("hex")
  const reg = await request.post(`${BACKEND_URL}/auth/customer/emailpass/register`, { data: { email, password } })
  if (reg.ok()) {
    const created = await request.post(`${BACKEND_URL}/store/customers`, {
      headers: { authorization: `Bearer ${(await reg.json()).token}`, "x-publishable-api-key": pk },
      data: { email, first_name: "Somchai", last_name: "Jaidee" },
    })
    expect(created.status(), "create customer").toBe(200)
  }
  const login = await request.post(`${BACKEND_URL}/auth/customer/emailpass`, { data: { email, password } })
  expect(login.status(), "customer login (อีเมลของ refund)").toBe(200)
  return { email, password, token: (await login.json()).token }
}

/** สถานะ refund ฝั่ง Stripe ของ PaymentIntent (key ของ CI แบบ pay-9) — คืนเฉพาะ status ไม่คืน next_action ที่มีอีเมล */
async function stripeRefundStatuses(request: APIRequestContext, intentId: string): Promise<string[]> {
  const res = await request.get(`https://api.stripe.com/v1/refunds?payment_intent=${intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), `list refunds of ${intentId}`).toBe(200)
  return ((await res.json()).data as { status: string }[]).map((r) => r.status)
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
  // ขอบล่างของ execution ที่อ่าน (เผื่อนาฬิกา DB/runner ต่างกัน)
  const startedAt = new Date(Date.now() - 60_000).toISOString()

  await step("Given ชำระพร้อมเพย์ตอน QR แสดง (webhook ไม่มา) แล้วลูกค้าใช้สิทธิ์ flash จาก cart อื่นผ่าน API", async () => {
    await page.addInitScript((selectors: string[]) => {
      const style = document.createElement("style")
      style.textContent = `${selectors.join(",")} { visibility: hidden !important; }`
      document.documentElement.appendChild(style)
    }, CONTACT_SELECTORS)
    const customer = await refundEmailCustomer(request, await publishableKey(request, admin))
    ctx = await paidWhileQrShown(page, context, request, baseURL!, [], { variant: variantId, customer })
    firstCollection = (await collectionOf(request, ctx)).id
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
    // Q-P15: Stripe สร้าง refund ได้ (พร้อมเพย์ = requires_action รอลูกค้ากรอกบัญชีจากอีเมล) — Medusa นับว่าคืนแล้วทันทีที่สร้างสำเร็จ
    const statuses = await stripeRefundStatuses(request, ctx.intentId)
    expect(statuses, "refund ของ PaymentIntent ฝั่ง Stripe").toHaveLength(1)
    expect(["requires_action", "pending", "succeeded"]).toContain(statuses[0])
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
