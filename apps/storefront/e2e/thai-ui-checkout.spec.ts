import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  shippingOptionId,
  signInAs,
} from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// CORE-4d: spec 01 CORE-4 (ADR-014) AC-48 ส่วน "ทุกขั้นของ checkout" + AC-75 (ประโยคยอมรับเงื่อนไขในขั้น review)
// หา element ด้วย data-testid เท่านั้น ตรวจ "เป็นภาษาไทย" ด้วยอักษรไทย (ไม่ hard-code ประโยค)
// ไม่เลือก element ที่มีข้อมูลจาก backend/ผู้ใช้ (ชื่อสินค้า, ที่อยู่, อีเมล, ชื่อวิธีจัดส่ง)
// ใช้ manual payment (seed CORE-2) — ไม่ต้องมี Stripe key; ข้อความ PromptPay/บัตรตรวจด้วย unit test (user-messages-thai)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4d" } })

const PRODUCT = "t-shirt"
const MANUAL = "pp_system_default"

test("AC-48 (4d), AC-75: checkout ทุกขั้นเป็นภาษาไทย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("ยังไม่มี cart → not-found ของ (checkout)", async () => {
    await page.goto(`/${CC}/checkout`)
    await expectThai(page, ["not-found-title", "not-found-description", "not-found-home-link"])
  })

  await step("ขั้นที่อยู่จัดส่ง", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(1)
    await page.getByTestId("checkout-button").click()
    await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()
    expect(await page.title()).toMatch(THAI)
    await expectThai(page, [
      "back-to-cart-link",
      "addresses-heading",
      "submit-address-button",
      "checkout-summary-heading",
      "add-discount-button",
    ])
    await evidence("4d-01-address-th")

    await page.getByTestId("shipping-first-name-input").fill("Somchai")
    await page.getByTestId("shipping-last-name-input").fill("Jaidee")
    await page.getByTestId("shipping-address-input").fill("1 Sukhumvit Rd")
    await page.getByTestId("shipping-postal-code-input").fill("10110")
    await page.getByTestId("shipping-city-input").fill("Bangkok")
    await page.getByTestId("shipping-country-select").selectOption(CC)
    await page.getByTestId("shipping-email-input").fill(customer.email)
    await page.getByTestId("submit-address-button").click()
  })

  await step("ขั้นจัดส่ง", async () => {
    await expect(page.getByTestId("delivery-options-container").first()).toBeVisible()
    await expectThai(page, ["delivery-heading", "delivery-method-title", "edit-address-button"])
    const standardId = await shippingOptionId(request, context, pk, customer, "Standard")
    await page.locator(`[data-testid="delivery-option-radio"][data-option-id="${standardId}"]`).click()
    await expect(page.getByTestId("submit-delivery-option-button")).toBeEnabled()
    await expectThai(page, ["submit-delivery-option-button"])
    await evidence("4d-02-delivery-th")
    await page.getByTestId("submit-delivery-option-button").click()
  })

  await step("ขั้นชำระเงิน", async () => {
    await expect(page.getByTestId(`payment-option-${MANUAL}`)).toBeVisible()
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    await expectThai(page, ["payment-heading", `payment-option-${MANUAL}`, "submit-payment-button"])
    await evidence("4d-03-payment-th")
    await page.getByTestId("submit-payment-button").click()
  })

  await step("ขั้น review: ประโยคยอมรับเงื่อนไขเป็นไทยและไม่มี Medusa (AC-75)", async () => {
    await expect(page.getByTestId("submit-order-button")).toBeVisible({ timeout: 30_000 })
    await expectThai(page, [
      "review-heading",
      "review-terms",
      "submit-order-button",
      "payment-method-summary",
      "edit-payment-button",
      "edit-delivery-button",
    ])
    await expect(page.getByTestId("review-terms")).not.toHaveText(/Medusa/i)
    await evidence("4d-04-review-th")
  })
})
