import { APIRequestContext, APIResponse, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { continueToReview } from "./support/stripe"

// CORE-57: spec 01 AC-156 (กฎข้อ 115, Q-C7 = ก) — cart-totals ใช้ฐานรวม VAT ทั้งชุด แถวค่าจัดส่ง = ราคา option ที่ลูกค้าเลือก
// (seed: Standard ฿10 is_tax_inclusive) ทั้งที่ /th/cart และขั้น review; subtotal − discount + shipping = total (ไม่บวก cart-taxes)
// หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-57" }, viewport: { width: 1280, height: 800 } })

const MANUAL = "pp_system_default"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

async function storeGet(request: APIRequestContext, pk: string, customer: Customer, path: string) {
  return ok(
    await request.get(`${BACKEND_URL}${path}`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    }),
    path
  )
}

/** แถวของ cart-totals ตามกฎข้อ 115 เทียบกับราคา option และ totals ของ API */
async function expectVatInclusiveRows(
  page: Page,
  expected: { shipping: number; originalShipping: number; total: number }
) {
  const totals = page.getByTestId("cart-totals")
  await expect(totals).toBeVisible()
  const shipping = await dataValue(totals.getByTestId("cart-shipping"))
  expect(shipping, "cart-shipping = amount ของ option").toBeCloseTo(expected.shipping, 2)
  expect(shipping, "cart-shipping = original_shipping_total").toBeCloseTo(expected.originalShipping, 2)

  const discount = totals.getByTestId("cart-discount")
  const rows =
    (await dataValue(totals.getByTestId("cart-subtotal"))) -
    ((await discount.count()) ? await dataValue(discount) : 0) +
    shipping
  const grand = await dataValue(totals.getByTestId("cart-total"))
  expect(Math.abs(rows - grand), `rows=${rows} total=${grand}`).toBeLessThanOrEqual(0.01)
  expect(grand).toBeCloseTo(expected.total, 2)
  await expect(totals).not.toContainText("ไม่รวมภาษี")
  await expect(totals).toContainText(/[฀-๿]/)
}

test("AC-156: ค่าจัดส่งใน cart-totals = ราคา option ที่เลือก และแถวรวม VAT รวมได้ยอดสุทธิ ที่ /th/cart และขั้น review", async ({
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
  const cartId = await cartReadyForPayment(request, pk, customer)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  const { cart } = await storeGet(request, pk, customer, `/store/carts/${cartId}`)
  const { shipping_options } = await storeGet(request, pk, customer, `/store/shipping-options?cart_id=${cartId}`)
  const chosen = shipping_options.find(
    (o: { id: string }) => o.id === cart.shipping_methods[0].shipping_option_id
  )
  // เงื่อนไขของกฎข้อ 115a: ราคา option รวม VAT — ถ้า seed เปลี่ยน (Q-F1) ให้ทบทวนกฎ ไม่แก้ test ให้ผ่าน
  expect(chosen?.is_tax_inclusive, "shipping option is_tax_inclusive").toBe(true)
  const expected = {
    shipping: Number(chosen.amount),
    originalShipping: Number(cart.original_shipping_total),
    total: Number(cart.total),
  }

  await step("/th/cart: cart-shipping = ราคา option, subtotal − discount + shipping = total", async () => {
    await page.goto(`/${CC}/cart`)
    await expectVatInclusiveRows(page, expected)
    await evidence("01-cart-vat-inclusive-totals")
  })

  await step("ขั้นเลือกวิธีจัดส่ง: option ที่เลือกแสดงราคาเดียวกับแถวค่าจัดส่ง", async () => {
    await page.goto(`/${CC}/checkout?step=delivery`)
    const shippingRow = page.getByTestId("cart-totals").getByTestId("cart-shipping")
    await expect(shippingRow).toBeVisible()
    const radio = page.locator(`[data-testid="delivery-option-radio"][data-option-id="${chosen.id}"]`)
    await expect(radio).toContainText(await shippingRow.innerText())
  })

  await step("ขั้น review: แถวเดิมยังเป็นฐานรวม VAT", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    await continueToReview(page)
    await expectVatInclusiveRows(page, expected)
    await evidence("02-review-vat-inclusive-totals")
  })
})
