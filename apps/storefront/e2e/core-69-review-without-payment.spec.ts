import { APIRequestContext, BrowserContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
  type Customer,
} from "./support/medusa"

// CORE-69 (spec 01 กฎข้อ 127, AC-168): cart มีที่อยู่ + วิธีส่งแล้วแต่ยังไม่มี payment session ที่ใช้ได้ เปิด ?step=review ตรงๆ
// → ไป ?step=payment (ขั้นแรกที่ยังไม่เสร็จ) พร้อมตัวเลือกการชำระเงิน ไม่ค้างหน้า review ที่ไม่มีปุ่ม
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-69" } })

const MANUAL = "pp_system_default"

const storeHeaders = (pk: string, customer: Customer) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers, data })
  expect(res.status(), `${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** สร้าง payment collection ของ cart (ไม่สร้าง session) คืน id */
async function paymentCollection(request: APIRequestContext, pk: string, customer: Customer, cartId: string) {
  const { payment_collection } = await post(request, storeHeaders(pk, customer), "/store/payment-collections", {
    cart_id: cartId,
  })
  return payment_collection.id as string
}

async function openAs(
  context: BrowserContext,
  baseURL: string,
  customer: Customer,
  cartId: string
) {
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
}

for (const withCollection of [false, true]) {
  const label = withCollection ? "มี payment collection แต่ไม่มี session" : "ไม่มี payment collection"

  test(`AC-168 cart มีที่อยู่ + Standard, ${label}: เปิด step=review → step=payment เห็นตัวเลือกการชำระเงิน`, async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    const cartId = await cartReadyForPayment(request, pk, customer)
    if (withCollection) await paymentCollection(request, pk, customer, cartId)
    await openAs(context, baseURL!, customer, cartId)

    await page.goto(`/${CC}/checkout?step=review`)
    await expect(page).toHaveURL(/[?&]step=payment(&|$)/, { timeout: 5_000 })
    await expect(page.locator('[data-testid^="payment-option-"]').first()).toBeVisible()
    await expect(page.getByTestId("submit-payment-button")).toBeVisible()
    await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    if (!withCollection) await evidence("01-review-without-session-redirected-to-payment")
  })
}

test("AC-168 regression: cart มี session ของ manual payment เปิด step=review → อยู่ที่ review และปุ่มสั่งซื้อพร้อม", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const collectionId = await paymentCollection(request, pk, customer, cartId)
  await post(request, storeHeaders(pk, customer), `/store/payment-collections/${collectionId}/payment-sessions`, {
    provider_id: MANUAL,
  })
  await openAs(context, baseURL!, customer, cartId)

  await page.goto(`/${CC}/checkout?step=review`)
  await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 30_000 })
  await expect(page).toHaveURL(/[?&]step=review(&|$)/)
})
