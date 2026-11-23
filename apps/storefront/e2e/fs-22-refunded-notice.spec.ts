import { APIRequestContext, Page } from "@playwright/test"

import { REFUNDED_NOTICE } from "../src/lib/util/checkout-error"
import { expect, test } from "./support/fixtures"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, STRIPE_SECRET, continueToReview, fillCard, sessionIntentId } from "./support/stripe"

// FS-22 (spec 03 กฎข้อ 27, AC-29): ลูกค้าอยู่ขั้น review ด้วยบัตรแล้วของหมดระหว่างนั้น (ลูกค้าอื่นซื้อไปก่อนผ่าน API)
// → กดสั่ง → Stripe ตัดเงิน → complete ล้ม → `checkout-refunded-notice` ภาษาไทยมีคำว่า "คืนเงิน" ไม่มี "ลองใหม่"
// (a) สต็อก inventory ชิ้นสุดท้าย (รูปแบบเดียวกับ e-voucher ใบสุดท้าย EV-M-22: 400 "Not enough stock available")
// (b) total_cap ของ flash ครบ (409 FLASH_SOLD_OUT); FLASH_LIMIT_EXCEEDED ตรวจใน `pay-9-refunded-cart-repay.spec.ts`
// manual payment (ไม่ตัดเงิน) คงข้อความเดิม — `flash-sale-fs15.spec.ts` AC-22
// complete เป็น server action ของ Next (request ฝั่ง server) จึง mock ด้วย page.route ไม่ได้ → ใช้ race จริง + Stripe test mode
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-22" } })

const THAI = /[฀-๿]/

let admin: Headers
let pk: string

async function stripeRefunds(request: APIRequestContext, intentId: string): Promise<string[]> {
  const res = await request.get(`https://api.stripe.com/v1/refunds?payment_intent=${intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), `list refunds of ${intentId}`).toBe(200)
  return (await res.json()).data.map((r: { status: string }) => r.status)
}

/** cart 1 ชิ้นของ `variant` ไปถึงขั้น review ด้วยบัตร 4242 คืน PaymentIntent id */
async function reviewWithCard(page: Page, request: APIRequestContext, customer: Customer, cartId: string) {
  await page.goto(`/${CC}/checkout?step=payment`)
  await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
  const intent = await sessionIntentId(request, pk, customer, cartId, CARD_PROVIDER)
  await fillCard(page, "4242424242424242")
  await continueToReview(page)
  await expect(page.getByTestId("submit-order-button")).toBeEnabled()
  return intent
}

async function expectRefundedNotice(page: Page) {
  await page.getByTestId("submit-order-button").click()
  const notice = page.getByTestId("checkout-refunded-notice")
  await expect(notice).toBeVisible({ timeout: 60_000 })
  await expect(notice).toHaveText(REFUNDED_NOTICE)
  await expect(notice).toHaveText(THAI)
  await expect(notice).toContainText("คืนเงิน")
  await expect(notice).not.toContainText("ลองใหม่")
  // error สีแดงเดิม ("ยืนยันคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") ไม่แสดง
  await expect(page.getByTestId("stripe-payment-error-message")).toHaveCount(0)
  await expect(page).toHaveURL(/\/checkout/)
}

test.beforeAll(async ({ request }) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
})

test("AC-29 (a): ชิ้นสุดท้ายถูกซื้อไประหว่างอยู่ขั้น review → จ่ายด้วยบัตร → checkout-refunded-notice และ Stripe คืนเงินจริง", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const { variantId } = await createFlashProduct(request, admin, "FS22-stock", 1)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  let intent = ""
  await step("ไปขั้น review ด้วยบัตร", async () => {
    intent = await reviewWithCard(page, request, customer, cartId)
  })

  await step("ลูกค้าอื่นซื้อชิ้นสุดท้ายผ่าน API", async () => {
    await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId, quantity: 1 })
  })

  await step("กดสั่งซื้อ → checkout-refunded-notice ไม่มีข้อความให้ลองใหม่", async () => {
    await expectRefundedNotice(page)
    await evidence("01-refunded-notice-out-of-stock")
  })

  await step("Medusa คืนเงินเต็มจำนวนจริง (ข้อความไม่หลอก)", async () => {
    await expect.poll(() => stripeRefunds(request, intent), { timeout: 60_000 }).toEqual(["succeeded"])
  })
})

test("AC-29 (b): total_cap ของ flash ครบระหว่างอยู่ขั้น review → จ่ายด้วยบัตร → checkout-refunded-notice", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(180_000)
  const { productId, variantId } = await createFlashProduct(request, admin, "FS22-flash", 100)
  const campaignId = await createFlashCampaign(request, admin, "FS22", productId, { total_cap: 1, show_countdown: true })
  try {
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

    await step("ไปขั้น review ด้วยบัตร", async () => {
      await reviewWithCard(page, request, customer, cartId)
    })

    await step("ลูกค้าอื่นซื้อสิทธิ์ flash ชิ้นสุดท้ายผ่าน API (units_sold = total_cap)", async () => {
      await placeOrder(request, pk, await createCustomer(request, pk), { variant: variantId, quantity: 1 })
    })

    await step("กดสั่งซื้อ → checkout-refunded-notice (FLASH_SOLD_OUT)", async () => {
      await expectRefundedNotice(page)
    })
  } finally {
    await endFlashCampaign(request, admin, campaignId)
  }
})
