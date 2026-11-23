import { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  type Customer,
} from "./support/medusa"

// CORE-89 (spec 01 กฎข้อ 145, AC-186): สรุปขั้น payment ที่ปิดแล้ว (ขั้น review ของ manual payment)
// < 640px → "วิธีชำระเงิน" กับ "รายละเอียดการชำระเงิน" ซ้อนกันเต็มความกว้าง (เดิม w-1/3 คู่กัน ~110px ตัดทีละคำ)
// ≥ 640px → สองกล่องอยู่แถวเดียวกันเหมือนเดิม
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-89" } })

const MANUAL = "pp_system_default"

/** cart ของ customer ที่มีที่อยู่ + Standard + session ของ manual payment แล้ว เปิดที่ขั้น review */
async function openReviewWithManualPayment(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  baseURL: string
) {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer: Customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { payment_collection } = await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } }),
    "payment collection"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      headers,
      data: { provider_id: MANUAL },
    }),
    "payment session"
  )
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  await page.goto(`/${CC}/checkout?step=review`)
  await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 30_000 })
  const method = page.getByTestId("payment-method-summary")
  const details = page.getByTestId("payment-details-summary")
  await expect(method).toBeVisible()
  await expect(details).toBeVisible()
  const methodBox = await method.boundingBox()
  const detailsBox = await details.boundingBox()
  expect(methodBox).not.toBeNull()
  expect(detailsBox).not.toBeNull()
  return { methodBox: methodBox!, detailsBox: detailsBox! }
}

test.describe("375×812", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("AC-186: payment-details-summary อยู่ใต้ payment-method-summary และกว้าง ≥ 300px", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const { methodBox, detailsBox } = await openReviewWithManualPayment(page, context, request, baseURL!)
    expect(detailsBox.y).toBeGreaterThanOrEqual(methodBox.y + methodBox.height)
    expect(detailsBox.width).toBeGreaterThanOrEqual(300)
    await page.getByTestId("payment-details-summary").scrollIntoViewIfNeeded()
    await evidence("01-payment-summary-375")
  })
})

// ≥ 640px (`sm` ของ Tailwind) คงแถวเดียว — 640 = ขอบล่างของกฎ, 1280 = AC-186
for (const width of [640, 1280]) {
  test(`AC-186 (${width}): สองกล่องสรุปการชำระเงินอยู่แถวเดียวกันเหมือนเดิม`, async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 800 })
    const { methodBox, detailsBox } = await openReviewWithManualPayment(page, context, request, baseURL!)
    // กล่องรายละเอียดอยู่ทางขวาของกล่องวิธีชำระ และเริ่มก่อนกล่องวิธีชำระจบ (แถวเดียวกัน)
    expect(detailsBox.x).toBeGreaterThanOrEqual(methodBox.x + methodBox.width)
    expect(detailsBox.y).toBeLessThan(methodBox.y + methodBox.height)
    await page.getByTestId("payment-details-summary").scrollIntoViewIfNeeded()
    await evidence(`02-payment-summary-${width}`)
  })
}
