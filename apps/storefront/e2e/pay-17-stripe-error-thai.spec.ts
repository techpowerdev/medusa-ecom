import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_UI,
  cartIdOf,
  cartPaymentState,
  checkoutToPayment,
  continueToReview,
  fillCard,
} from "./support/stripe"
import { expectThai } from "./support/thai-text"

// PAY-17 (spec 06 กฎข้อ 19a, AC-30a): ขั้น review `stripe.confirmPayment` คืน error card_error/card_declined → ลูกค้าเห็นข้อความไทย
// ไม่เห็น `error.message` ของ Stripe — route mock: บัตรถูกปฏิเสธของ test mode (4000 0000 0000 0002) แล้วแทน `message` ใน response
// ของ confirm ด้วยข้อความอังกฤษ (Elements ตั้ง locale th — Stripe อาจแปลข้อความให้ จึงบังคับให้เป็นอังกฤษเพื่อพิสูจน์ว่าไม่แสดงตรง)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-17" } })

const PRODUCT = "t-shirt"
const DECLINED_CARD = "4000000000000002"
const DECLINED_EN = "Your card was declined."
const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

test.describe("ข้อความไทยของ error Stripe ขั้น review (AC-30a)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("confirmPayment ได้ card_error/card_declined ข้อความอังกฤษ → stripe-payment-error-message เป็นไทย ไม่มีข้อความของ Stripe", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const confirms: { type?: string; code?: string }[] = []

    await step("Given ขั้น review ด้วยบัตรที่ถูกปฏิเสธ และ response ของ confirm มีข้อความอังกฤษ", async () => {
      await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
      await page.route(/api\.stripe\.com\/v1\/payment_intents\/[^/]+\/confirm/, async (route) => {
        const res = await route.fetch()
        const body = await res.json()
        if (body?.error) {
          confirms.push({ type: body.error.type, code: body.error.code })
          body.error.message = DECLINED_EN
        }
        await route.fulfill({ response: res, json: body })
      })
      await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
      await fillCard(page, DECLINED_CARD)
      await continueToReview(page)
    })

    await step("When ยืนยันคำสั่งซื้อ → Then เห็นข้อความไทย ไม่มีข้อความอังกฤษของ Stripe", async () => {
      await page.getByTestId("submit-order-button").click()
      const shown = page.getByTestId("stripe-payment-error-message")
      await expect(shown).toBeVisible({ timeout: 30_000 })
      expect(confirms, "response ของ confirm เป็น card_error/card_declined").toContainEqual({
        type: "card_error",
        code: "card_declined",
      })
      await expectThai(page, ["stripe-payment-error-message"])
      await expect(page.getByText(DECLINED_EN)).toHaveCount(0)
      await expect(page.getByTestId("submit-order-button")).toBeEnabled()
      await evidence("01-card-declined-thai")
    })

    await step("And ไม่มี order: cart ยังไม่ completed", async () => {
      const state = await cartPaymentState(request, pk, customer, await cartIdOf(context))
      expect(state.completed_at).toBeNull()
    })
  })
})
