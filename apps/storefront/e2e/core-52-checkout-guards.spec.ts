import { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { createVoucher, placeCapturedOrder } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
  type Customer,
  variantOf,
} from "./support/medusa"
import { waitForServerAction } from "./support/server-action"

// CORE-52 (spec 01 กฎข้อ 110, AC-147): ตะกร้าว่างจากอีกแท็บ → /cart (reload และกดยืนยัน), ช่องที่อยู่ที่เป็นช่องว่างล้วน
// ไม่ผ่านและ select ประเทศคงค่า, order voucher ล้วนไม่มี section จัดส่ง
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-52" } })

const THAI = /[฀-๿]/
const MANUAL = "pp_system_default"
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]

const storeHeaders = (pk: string, customer: Customer) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
async function call(request: APIRequestContext, headers: Record<string, string>, path: string, data?: unknown): Promise<any> {
  const res = data === undefined
    ? await request.get(`${BACKEND_URL}${path}`, { headers })
    : await request.post(`${BACKEND_URL}${path}`, { headers, data })
  expect(res.status(), `${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** cart ที่มีแค่ line item (ไม่มีที่อยู่) — ฟอร์มที่อยู่เปิดด้วยค่าว่าง select ประเทศเริ่มที่ placeholder */
async function cartWithItem(request: APIRequestContext, pk: string, customer: Customer, variantId: string) {
  const headers = storeHeaders(pk, customer)
  const { regions } = await call(request, headers, "/store/regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await call(request, headers, "/store/carts", { region_id: region.id })
  await call(request, headers, `/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 1 })
  return cart.id as string
}

/** cart พร้อมขั้น review: ที่อยู่ + Standard + session ของ manual payment (ผ่าน Store API ด้วย token เจ้าของ cart) */
async function cartAtReview(request: APIRequestContext, pk: string, customer: Customer) {
  const headers = storeHeaders(pk, customer)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const { payment_collection } = await call(request, headers, "/store/payment-collections", { cart_id: cartId })
  await call(request, headers, `/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    provider_id: MANUAL,
  })
  return cartId
}

/** ลบทุก line ของ cart ผ่าน Store API (เหมือนลูกค้าล้างตะกร้าจากอีกแท็บ) */
async function emptyCart(request: APIRequestContext, pk: string, customer: Customer, cartId: string) {
  const headers = storeHeaders(pk, customer)
  const { cart } = await call(request, headers, `/store/carts/${cartId}?fields=id,*items`)
  for (const item of cart.items) {
    const res = await request.delete(`${BACKEND_URL}/store/carts/${cartId}/line-items/${item.id}`, { headers })
    expect(res.status(), `delete line item: ${await res.text()}`).toBe(200)
  }
  const after = await call(request, headers, `/store/carts/${cartId}?fields=id,*items`)
  expect(after.cart.items).toHaveLength(0)
}

const orderCount = async (request: APIRequestContext, pk: string, customer: Customer) =>
  (await call(request, storeHeaders(pk, customer), "/store/orders?fields=id")).orders.length as number

async function signedInWithCart(context: BrowserContext, baseURL: string, customer: Customer, cartId: string) {
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
}

async function openReview(page: Page) {
  await page.goto(`/${CC}/checkout?step=review`)
  await expect(page).toHaveURL(/step=review/)
  await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 30_000 })
}

for (const viewport of VIEWPORTS) {
  const label = `${viewport.width}x${viewport.height}`
  const saveEvidence = viewport.width === 1280

  test.describe(`viewport ${label}`, () => {
    test.use({ viewport })

    test(`AC-147 ตะกร้าว่างจากอีกแท็บ: reload ขั้น review → /th/cart (${label})`, async ({
      page,
      context,
      request,
      baseURL,
      evidence,
    }) => {
      test.setTimeout(120_000)
      const pk = await publishableKey(request, await adminHeaders(request))
      const customer = await createCustomer(request, pk)
      const cartId = await cartAtReview(request, pk, customer)
      await signedInWithCart(context, baseURL!, customer, cartId)
      await openReview(page)

      await emptyCart(request, pk, customer, cartId)
      await page.reload()

      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))
      await expect(page.getByTestId("empty-cart-message")).toBeVisible()
      if (saveEvidence) await evidence("01-empty-cart-reload-redirect")
    })

    test(`AC-147 ตะกร้าว่างจากอีกแท็บ: กดยืนยันโดยไม่ reload → /th/cart ไม่เกิด order (${label})`, async ({
      page,
      context,
      request,
      baseURL,
    }) => {
      test.setTimeout(120_000)
      const pk = await publishableKey(request, await adminHeaders(request))
      const customer = await createCustomer(request, pk)
      const cartId = await cartAtReview(request, pk, customer)
      await signedInWithCart(context, baseURL!, customer, cartId)
      await openReview(page)
      const before = await orderCount(request, pk, customer)

      await emptyCart(request, pk, customer, cartId)
      await page.getByTestId("submit-order-button").click()

      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`), { timeout: 30_000 })
      await expect(page.getByTestId("empty-cart-message")).toBeVisible()
      expect(await orderCount(request, pk, customer)).toBe(before)
    })

    test(`AC-147 เขต/อำเภอเป็นช่องว่างล้วน → error ไทย ไม่บันทึก select ประเทศคงค่า (${label})`, async ({
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
      const cartId = await cartWithItem(request, pk, customer, variantId)
      await signedInWithCart(context, baseURL!, customer, cartId)

      await page.goto(`/${CC}/checkout?step=address`)
      await page.getByTestId("shipping-first-name-input").fill("สมชาย")
      await page.getByTestId("shipping-last-name-input").fill("ใจดี")
      await page.getByTestId("shipping-address-input").fill("99 ถนนสุขุมวิท")
      await page.getByTestId("shipping-postal-code-input").fill("10110")
      await page.getByTestId("shipping-city-input").fill("   ")
      await page.getByTestId("shipping-country-select").selectOption(CC)
      await page.getByTestId("shipping-email-input").fill(customer.email)
      const saved = waitForServerAction(page, (body) => body.includes(customer.email))
      await page.getByTestId("submit-address-button").click()
      await saved

      await expect(page.getByTestId("address-error-message")).toHaveText(THAI)
      await expect(page).toHaveURL(/step=address/)
      await expect(page.getByTestId("shipping-country-select")).toHaveValue(CC)
      const { cart } = await call(request, storeHeaders(pk, customer), `/store/carts/${cartId}?fields=id,*shipping_address`)
      expect(cart.shipping_address?.city ?? null, "ไม่บันทึกเมืองว่างลง cart").toBeNull()
      if (saveEvidence) await evidence("02-blank-city-error-country-kept")
    })

    // qa #353 D-1: หลัง error checkbox "ใช้ที่อยู่จัดส่งเป็นที่อยู่ใบเสร็จ" ต้องไม่กลับเป็นติ๊ก (form reset ของ React 19)
    // ไม่งั้นส่งใหม่ได้ same_as_billing=on แล้วที่อยู่ใบเสร็จที่กรอกหายเงียบ
    test(`AC-147 ใบเสร็จแยก: error แล้วแก้ส่งใหม่ → billing เป็นค่าที่กรอก (${label})`, async ({
      page,
      context,
      request,
      baseURL,
    }) => {
      test.setTimeout(120_000)
      const pk = await publishableKey(request, await adminHeaders(request))
      const customer = await createCustomer(request, pk)
      const { variantId } = await variantOf(request, pk, "t-shirt")
      const cartId = await cartWithItem(request, pk, customer, variantId)
      await signedInWithCart(context, baseURL!, customer, cartId)

      await page.goto(`/${CC}/checkout?step=address`)
      await page.getByTestId("shipping-first-name-input").fill("สมชาย")
      await page.getByTestId("shipping-last-name-input").fill("ใจดี")
      await page.getByTestId("shipping-address-input").fill("99 ถนนสุขุมวิท")
      await page.getByTestId("shipping-postal-code-input").fill("10110")
      await page.getByTestId("shipping-city-input").fill("วัฒนา")
      await page.getByTestId("shipping-country-select").selectOption(CC)
      await page.getByTestId("shipping-email-input").fill(customer.email)
      const checkbox = page.getByTestId("billing-address-checkbox")
      await checkbox.click()
      await expect(checkbox).not.toBeChecked()
      await page.getByTestId("billing-first-name-input").fill("สมหญิง")
      await page.getByTestId("billing-last-name-input").fill("รักดี")
      await page.getByTestId("billing-address-input").fill("1 ถนนสีลม")
      await page.getByTestId("billing-postal-input").fill("10500")
      await page.getByTestId("billing-city-input").fill("   ")
      await page.getByTestId("billing-country-select").selectOption(CC)
      const failed = waitForServerAction(page, (body) => body.includes(customer.email))
      await page.getByTestId("submit-address-button").click()
      await failed

      await expect(page.getByTestId("address-error-message")).toHaveText(THAI)
      await expect(checkbox).not.toBeChecked()
      await expect(page.getByTestId("billing-first-name-input")).toHaveValue("สมหญิง")
      await expect(page.getByTestId("billing-country-select")).toHaveValue(CC)

      await page.getByTestId("billing-city-input").fill("บางรัก")
      const saved = waitForServerAction(page, (body) => body.includes(customer.email))
      await page.getByTestId("submit-address-button").click()
      expect((await saved).headers()["x-action-redirect"]).toMatch(/step=delivery/)
      const { cart } = await call(request, storeHeaders(pk, customer), `/store/carts/${cartId}?fields=id,*billing_address`)
      expect(cart.billing_address).toMatchObject({ first_name: "สมหญิง", city: "บางรัก", postal_code: "10500" })
    })

    test(`AC-147 cart digital-only: เขต/อำเภอเป็นช่องว่างล้วน → error ไทย billing select คงค่า (${label})`, async ({
      page,
      context,
      request,
      baseURL,
    }) => {
      test.setTimeout(150_000)
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const voucher = await createVoucher(request, admin)
      const cartId = await cartWithItem(request, pk, customer, voucher.variantId)
      await signedInWithCart(context, baseURL!, customer, cartId)

      await page.goto(`/${CC}/checkout?step=address`)
      // ค่าเริ่มต้นเป็น placeholder — ถ้า reset ของ form ย้อนกลับ ค่าจะไม่ใช่ CC
      await expect(page.getByTestId("billing-country-select")).toHaveValue("")
      await page.getByTestId("billing-first-name-input").fill("สมชาย")
      await page.getByTestId("billing-last-name-input").fill("ใจดี")
      await page.getByTestId("billing-address-input").fill("99 ถนนสุขุมวิท")
      await page.getByTestId("billing-postal-input").fill("10110")
      await page.getByTestId("billing-city-input").fill("   ")
      await page.getByTestId("billing-country-select").selectOption(CC)
      await page.getByTestId("billing-email-input").fill(customer.email)
      const saved = waitForServerAction(page, (body) => body.includes(customer.email))
      await page.getByTestId("submit-address-button").click()
      await saved

      await expect(page.getByTestId("address-error-message")).toHaveText(THAI)
      await expect(page).toHaveURL(/step=address/)
      await expect(page.getByTestId("billing-country-select")).toHaveValue(CC)
      const { cart } = await call(request, storeHeaders(pk, customer), `/store/carts/${cartId}?fields=id,*billing_address`)
      expect(cart.billing_address?.city ?? null, "ไม่บันทึกเมืองว่างลง cart").toBeNull()
    })

    test(`AC-147 order voucher ล้วนไม่มี section จัดส่ง, order สินค้าจัดส่งยังมี (${label})`, async ({
      page,
      context,
      request,
      baseURL,
      evidence,
    }) => {
      test.setTimeout(180_000)
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      await signInAs(context, baseURL!, customer)
      const voucher = await createVoucher(request, admin)
      const voucherOrder = await placeCapturedOrder(request, admin, pk, customer, voucher.variantId, 1)
      const shippedOrder = (await placeOrder(request, pk, customer)).id

      await page.goto(`/${CC}/order/${voucherOrder}/confirmed`)
      await expect(page.getByTestId("order-complete-heading")).toBeVisible()
      await expect(page.getByTestId("payment-details-heading")).toBeVisible()
      await expect(page.getByTestId("shipping-details-heading")).toHaveCount(0)
      if (saveEvidence) await evidence("03-voucher-order-confirmed-no-shipping")

      await page.goto(`/${CC}/account/orders/details/${voucherOrder}`)
      await expect(page.getByTestId("order-details-container")).toBeVisible()
      await expect(page.getByTestId("shipping-details-heading")).toHaveCount(0)
      if (saveEvidence) await evidence("04-voucher-order-details-no-shipping")

      for (const url of [`/${CC}/order/${shippedOrder}/confirmed`, `/${CC}/account/orders/details/${shippedOrder}`]) {
        await page.goto(url)
        await expect(page.getByTestId("shipping-details-heading")).toBeVisible()
      }
    })
  })
}
