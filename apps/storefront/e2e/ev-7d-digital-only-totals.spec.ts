import { expect, test } from "./support/fixtures"
import { createVoucher } from "./support/evoucher"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp, waitForServerAction } from "./support/server-action"

// EV-7d (spec 02 กฎข้อ 28a, AC-42): cart-totals ของ cart digital-only ไม่มีแถว/คำว่าค่าจัดส่ง ทั้งหน้าตะกร้าและขั้น review;
// cart ผสมยังมีแถวค่าจัดส่ง
test.use({ evidenceTarget: { feature: "evoucher", taskId: "EV-7d" } })

const MANUAL = "pp_system_default"

test("AC-42: cart digital-only ไม่มีค่าจัดส่งใน cart-totals ที่ /cart และขั้น review", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const voucher = await createVoucher(request, admin)

  await step("หน้าตะกร้า: ไม่มีแถวค่าจัดส่ง", async () => {
    await page.goto(`/${CC}/products/${voucher.handle}`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(1)
    await expect(page.getByTestId("cart-total")).toBeVisible()
    await expect(page.getByTestId("cart-totals")).not.toContainText("ค่าจัดส่ง")
    await expect(page.getByTestId("cart-shipping")).toHaveCount(0)
    await evidence("01-cart-digital-only-totals")
    await page.getByTestId("checkout-button").click()
    await expect(page).toHaveURL(/step=address/)
  })

  await step("ฟอร์มใบกำกับภาษี → ขั้นชำระเงินของ country ใน URL", async () => {
    await page.getByTestId("billing-first-name-input").fill("สมชาย")
    await page.getByTestId("billing-last-name-input").fill("ใจดี")
    await page.getByTestId("billing-address-input").fill("99 ถนนสุขุมวิท")
    await page.getByTestId("billing-postal-input").fill("10110")
    // CORE-52 (spec 01 กฎข้อ 110b): เขต/อำเภอเป็นช่องบังคับของที่อยู่ใบกำกับภาษีด้วย
    await page.getByTestId("billing-city-input").fill("วัฒนา")
    await page.getByTestId("billing-country-select").selectOption(CC)
    await page.getByTestId("billing-email-input").fill(customer.email)
    const saved = waitForServerAction(page, (body) => body.includes(customer.email))
    await page.getByTestId("submit-address-button").click()
    expect((await saved).headers()["x-action-redirect"]).toMatch(new RegExp(`^/${CC}/checkout\\?step=payment`))
  })

  await step("ขั้น review: ไม่มีแถวค่าจัดส่ง", async () => {
    await expect(page).toHaveURL(/step=payment/)
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    await page.getByTestId("submit-payment-button").click()
    await expect(page).toHaveURL(/step=review/, { timeout: 30_000 })
    await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 30_000 })
    await expect(page.getByTestId("cart-totals")).not.toContainText("ค่าจัดส่ง")
    await expect(page.getByTestId("cart-shipping")).toHaveCount(0)
    await evidence("02-review-digital-only-totals")
  })
})

test("AC-42: cart ผสม voucher + สินค้าจัดส่ง ยังมีแถวค่าจัดส่ง", async ({ page, context, request, baseURL, step }) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const voucher = await createVoucher(request, admin)

  await step("หน้าตะกร้า cart ผสม", async () => {
    for (const product of [voucher.handle, "t-shirt"]) {
      await page.goto(`/${CC}/products/${product}`)
      await addToCartFromPdp(page, { request, pk, customer })
    }
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(2)
    await expect(page.getByTestId("cart-shipping")).toBeVisible()
    await expect(page.getByTestId("cart-totals")).toContainText("ค่าจัดส่ง")
  })
})
