import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import {
  CARD_PROVIDER,
  HAS_STRIPE_UI,
  PROMPTPAY_PROVIDER,
  cartIdOf,
  cartPaymentState,
  checkoutToPayment,
  continueToReview,
  fillCard,
} from "./support/stripe"

// CORE-19f: spec 01 กฎข้อ 75 (c), AC-113 — สลับ บัตร → พร้อมเพย์ → บัตร แล้วกด Continue ครั้งเดียว → ขั้น review แสดงวิธีบัตร
// (เดิม qa #166/#151: review แสดงวิธีที่เลือกก่อนหน้า หรือส่วนการชำระเงินว่าง เพราะ cart ใน props ยังไม่มี session ล่าสุด)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-19f" } })

const CARD_TITLE = "บัตรเครดิต/เดบิต"

test("AC-113: บัตร → พร้อมเพย์ → บัตร แล้วกด Continue 1 ครั้ง → review แสดงบัตรและ cart มี session บัตรเท่านั้น", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await checkoutToPayment(page, context, request, pk, customer, CC, "t-shirt")
  const cartId = await cartIdOf(context)
  const submit = page.getByTestId("submit-payment-button")

  await step("เลือกบัตร → พร้อมเพย์ → บัตร (ปุ่ม Continue ล็อกระหว่างรอ session ทุกครั้ง)", async () => {
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    // พร้อมเพย์ไม่ต้องกรอกข้อมูล → ปุ่มกดได้เมื่อ cart มี session พร้อมเพย์แล้ว
    await expect(submit).toBeEnabled({ timeout: 15_000 })
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4242424242424242")
  })

  await step("กด Continue ครั้งเดียว → review แสดงวิธีชำระเป็นบัตร", async () => {
    await continueToReview(page)
    await expect(page.getByTestId("payment-method-summary")).toHaveText(CARD_TITLE)
    await evidence("01-review-shows-card-after-switch")
    const { sessions } = await cartPaymentState(request, pk, customer, cartId)
    expect(sessions.map((s) => s.provider_id)).toEqual([CARD_PROVIDER])
  })
})
