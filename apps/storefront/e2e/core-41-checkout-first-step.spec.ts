import { APIRequestContext } from "@playwright/test"

import { createVoucher } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
  type Customer,
  variantOf,
} from "./support/medusa"

// CORE-41 (spec 01 กฎข้อ 99, AC-135): เปิด ?step=payment / ?step=review ตรงๆ ขณะยังไม่มีที่อยู่ → ไปขั้นแรกที่ยังไม่เสร็จ
// (?step=address พร้อมฟอร์มที่อยู่เปิด) ไม่ใช่ delivery; cart ที่พร้อมจ่ายแล้วเปิด ?step=payment ตรงๆ ต้องไม่ถูก redirect
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-41" } })

/** cart ใหม่ของ customer ผ่าน Store API ที่มีแค่ line item (ไม่มีที่อยู่/shipping method) */
async function cartWithoutAddress(request: APIRequestContext, pk: string, customer: Customer, variantId: string) {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const regionsRes = await request.get(`${BACKEND_URL}/store/regions`, { headers })
  expect(regionsRes.status(), "regions").toBe(200)
  const region = (await regionsRes.json()).regions.find((r: { countries: { iso_2: string }[] }) =>
    r.countries.some((c) => c.iso_2 === CC)
  )
  const created = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
  expect(created.status(), `create cart: ${await created.text()}`).toBe(200)
  const cartId = (await created.json()).cart.id as string
  const line = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
    headers,
    data: { variant_id: variantId, quantity: 1 },
  })
  expect(line.status(), `add line item: ${await line.text()}`).toBe(200)
  const cart = (await line.json()).cart
  expect(cart.shipping_address?.address_1 ?? null, "cart ยังไม่มีที่อยู่").toBeNull()
  return cartId
}

test("AC-135 cart t-shirt ไม่มีที่อยู่: เปิด step=payment/review ตรงๆ → step=address ฟอร์มที่อยู่เปิด", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, "t-shirt")
  const cartId = await cartWithoutAddress(request, pk, customer, variantId)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  for (const step of ["payment", "review"]) {
    await page.goto(`/${CC}/checkout?step=${step}`)
    await expect(page).toHaveURL(/[?&]step=address(&|$)/)
    await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()
    await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    if (step === "review") await evidence("01-tshirt-review-redirected-to-address")
  }
})

test("AC-135 cart digital-only ไม่มีที่อยู่: เปิด step=review ตรงๆ → step=address ฟอร์มที่อยู่ใบเสร็จเปิด", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const voucher = await createVoucher(request, admin, 1)
  const cartId = await cartWithoutAddress(request, pk, customer, voucher.variantId)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await page.goto(`/${CC}/checkout?step=review`)
  await expect(page).toHaveURL(/[?&]step=address(&|$)/)
  await expect(page.getByTestId("billing-first-name-input")).toBeVisible()
  await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
  await evidence("02-digital-only-review-redirected-to-address")
})

test("AC-135 regression: cart มีที่อยู่ + Standard เปิด step=payment ตรงๆ → ไม่ถูก redirect", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await page.goto(`/${CC}/checkout?step=payment`)
  await expect(page.getByTestId("submit-payment-button")).toBeVisible()
  await expect(page).toHaveURL(/[?&]step=payment(&|$)/)
})
