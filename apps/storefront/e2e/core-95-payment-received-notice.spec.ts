import type { Page } from "@playwright/test"

import { PAYMENT_RECEIVED_NOTICE } from "../src/lib/util/login-notice"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Customer, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, checkoutToPayment, continueToReview, fillCard } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// CORE-95 (spec 01 กฎข้อ 151, AC-192 — owner Q-C16 = ก): จ่ายบัตรแล้ว (PI succeeded) แต่ session หมดก่อน complete
// → `/<cc>/account?notice=payment_received` + notice ไทย; login แล้วไป `/<cc>/account/orders`; `notice` เป็น allow-list ค่าเดียว
// (d) manual + 401 → `/<cc>/account` ไม่มี notice อยู่ใน core-76-place-order-outcome.spec.ts (regression CORE-76)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-95" } })

const NOTICE = "login-payment-received-notice"
const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

async function newCustomer(request: Parameters<typeof adminHeaders>[0]) {
  const pk = await publishableKey(request, await adminHeaders(request))
  return { pk, customer: await createCustomer(request, pk) }
}

async function signInWithForm(page: Page, customer: Customer) {
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
}

test("(a) บัตร PI succeeded แล้ว session หมด → login พร้อม notice แล้วไปหน้า orders", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)
  test.setTimeout(180_000)
  const { pk, customer } = await newCustomer(request)
  await signInAs(context, baseURL!, customer)

  await step("ขั้น review ด้วยบัตร 4242 แล้ว session หมด (ลบ `_medusa_jwt`)", async () => {
    await checkoutToPayment(page, context, request, pk, customer, CC, "t-shirt")
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4242424242424242")
    await continueToReview(page)
    await context.clearCookies({ name: "_medusa_jwt" })
  })

  await step("ยืนยันคำสั่งซื้อ → Stripe ตัดเงิน, complete ได้ 401 → /th/account?notice=payment_received", async () => {
    await page.getByTestId("submit-order-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?notice=payment_received$`), { timeout: 60_000 })
    await expect(page.getByTestId(NOTICE)).toHaveText(PAYMENT_RECEIVED_NOTICE)
    await expectThai(page, [NOTICE])
  })

  await step("login → /th/account/orders", async () => {
    await signInWithForm(page, customer)
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders$`), { timeout: 30_000 })
  })
})

test("(a)(b) notice=payment_received → notice ไทย แล้ว login ไป /th/account/orders", async ({ page, request, step, evidence }) => {
  const { customer } = await newCustomer(request)

  await step("เปิดหน้า login พร้อม notice", async () => {
    await page.goto(`/${CC}/account?notice=payment_received`)
    await expect(page.getByTestId(NOTICE)).toHaveText(PAYMENT_RECEIVED_NOTICE)
    await expectThai(page, [NOTICE])
    await evidence("01-login-payment-received-notice")
  })

  await step("login สำเร็จ → /th/account/orders", async () => {
    await signInWithForm(page, customer)
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders$`), { timeout: 30_000 })
    await expect(page.getByTestId(NOTICE)).toHaveCount(0)
  })
})

for (const value of ["<script>alert(1)</script>", "x"]) {
  test(`(c) notice=${value} → ไม่มี notice ไม่ render ค่าจาก URL`, async ({ page }) => {
    const dialogs: string[] = []
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message())
      void dialog.dismiss()
    })
    await page.goto(`/${CC}/account?${new URLSearchParams({ notice: value })}`)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(page.getByTestId(NOTICE)).toHaveCount(0)
    await expect(page.getByText("alert(1)")).toHaveCount(0)
    await expect(page.locator(`input[name="notice"]`)).toHaveCount(0)
    expect(dialogs).toEqual([])
  })
}

test("login ปกติ (ไม่มี notice) → คงอยู่หน้า /th/account (ไม่ไปหน้า orders)", async ({ page, request }) => {
  const { customer } = await newCustomer(request)
  await page.goto(`/${CC}/account`)
  await signInWithForm(page, customer)
  await expect(page.getByTestId("customer-email")).toHaveText(customer.email, { timeout: 30_000 })
  await expect(page).toHaveURL(new RegExp(`/${CC}/account$`))
})
