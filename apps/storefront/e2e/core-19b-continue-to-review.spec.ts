import type { Page, Request } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { HAS_STRIPE_UI, PROMPTPAY_PROVIDER, cartPaymentState } from "./support/stripe"

// CORE-19b: spec 01 AC-64 — กด "Continue to review" (submit-payment-button) ครั้งเดียวต้องไปขั้น review ทุกรอบ
// ใช้ pp_system_default ของ seed (ไม่ต้องใช้ Stripe) และ cart ใหม่ทุกรอบ → handleSubmit สร้าง payment session
// ผ่าน server action (revalidate cart) ก่อนเปลี่ยน step ทุกครั้ง ซึ่งเป็นจังหวะที่ starter เดิมค้างที่ขั้น payment
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-19b" } })

const MANUAL = "pp_system_default"
const ROUNDS = 20

test("AC-64: กด Continue to review ครั้งเดียว 20 รอบ (cart ใหม่ทุกรอบ) → step=review ภายใน 10 วินาที", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(ROUNDS * 30_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  for (let round = 1; round <= ROUNDS; round++) {
    await step(`รอบ ${round}: cart ใหม่ → กดครั้งเดียว → review`, async () => {
      const cartId = await cartReadyForPayment(request, pk, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      await page.goto(`/${CC}/checkout?step=payment`)

      await page.getByTestId(`payment-option-${MANUAL}`).click()
      const submit = page.getByTestId("submit-payment-button")
      await expect(submit).toBeEnabled()
      await submit.click()

      await expect(page, `รอบ ${round}`).toHaveURL(/[?&]step=review(&|$)/, { timeout: 10_000 })
      await expect(page.getByTestId("submit-order-button")).toBeVisible({ timeout: 10_000 })
      if (round === ROUNDS) await evidence("01-review-after-single-click")
    })
  }
})

/**
 * กดปุ่ม Continue ทันทีที่ปุ่มกลับมา enabled หลังเลือกวิธีชำระ (เร็วกว่าการคลิกของ Playwright) — จับจังหวะที่
 * server action สร้าง session เสร็จแล้วแต่ cart ใน props ยังไม่ refresh (เดิมกดตรงนี้ = สร้าง session ซ้ำแล้วค้างที่ขั้น payment)
 */
async function clickContinueAsSoonAsEnabled(page: Page) {
  await page.evaluate(() => {
    let armed = false
    const observer = new MutationObserver(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="submit-payment-button"]')
      if (!button) return
      if (button.disabled) armed = true
      else if (armed) {
        observer.disconnect()
        button.click()
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  })
}

test("AC-64: PromptPay — กดครั้งเดียวทันทีที่ปุ่มพร้อม 20 รอบ → step=review ภายใน 10 วินาที และมี session เดียว", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  test.setTimeout(ROUNDS * 30_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  for (let round = 1; round <= ROUNDS; round++) {
    await step(`รอบ ${round}: cart ใหม่ → เลือกพร้อมเพย์ → กดทันทีครั้งเดียว → review`, async () => {
      const cartId = await cartReadyForPayment(request, pk, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      await page.goto(`/${CC}/checkout?step=payment`)

      // server action ที่ browser ยิงหลังเลือกวิธีชำระ: ต้องมีแค่การสร้าง session ตอนเลือก (กดซ้อน = สร้างซ้ำ, PI แรกถูก cancel)
      let serverActions = 0
      const countAction = (req: Request) => {
        if (req.method() === "POST" && req.headers()["next-action"]) serverActions++
      }
      await clickContinueAsSoonAsEnabled(page)
      page.on("request", countAction)
      await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()

      await expect(page, `รอบ ${round}`).toHaveURL(/[?&]step=review(&|$)/, { timeout: 10_000 })
      await expect(page.getByTestId("submit-order-button")).toBeVisible({ timeout: 10_000 })
      page.off("request", countAction)
      expect(serverActions, "สร้าง payment session ครั้งเดียว").toBe(1)
      const { sessions } = await cartPaymentState(request, pk, customer, cartId)
      expect(sessions.map((s) => s.provider_id)).toEqual([PROMPTPAY_PROVIDER])
    })
  }
})
