import crypto from "node:crypto"

import { APIResponse, Locator } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
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

// CORE-64: spec 01 AC-163(b) (กฎข้อ 122) — promotion fixed ฿100 ที่ is_tax_inclusive: true บนสินค้า seed (ราคารวม VAT)
// → แถวส่วนลดของ /th/cart = 100 พอดี และแถวรวมได้ยอดสุทธิ (กฎข้อ 115) · หาภายใน cart-totals ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-64" }, viewport: { width: 1280, height: 800 } })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

test("AC-163(b): ส่วนลด fixed ฿100 แบบรวม VAT แสดงในตะกร้าเป็น 100 พอดี และแถวรวมได้ยอดสุทธิ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer: Customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  let promotionId: string | undefined
  try {
    await step("admin สร้าง Amount off products ฿100 ที่เปิด is_tax_inclusive แล้วลูกค้าใช้โค้ด", async () => {
      const code = `CORE64${Date.now()}${crypto.randomInt(1e6)}`
      // รูป body เดียวกับฟอร์มสร้างของ dashboard 2.22.1 (template "Amount off products") — ต่างแค่ status active
      const created = await request.post(`${BACKEND_URL}/admin/promotions`, {
        headers: admin,
        data: {
          code,
          type: "standard",
          status: "active",
          is_automatic: false,
          is_tax_inclusive: true,
          rules: [],
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "each",
            max_quantity: 1,
            value: 100,
            currency_code: "thb",
            target_rules: [],
            buy_rules: [],
          },
        },
      })
      expect(created.ok(), `create promotion: ${await created.text()}`).toBe(true)
      const { promotion } = await created.json()
      promotionId = promotion.id
      expect(promotion.is_tax_inclusive, "is_tax_inclusive ของ promotion").toBe(true)

      const { cart } = await ok(
        await request.post(`${BACKEND_URL}/store/carts/${cartId}/promotions`, {
          headers: store,
          data: { promo_codes: [code] },
        }),
        "apply promotion"
      )
      const discountTotal = Number(cart.discount_total)
      expect(Math.abs(discountTotal - 100), `discount_total=${discountTotal}`).toBeLessThanOrEqual(0.01)
    })

    await step("/th/cart: cart-discount = 100 และ subtotal − discount + shipping = total", async () => {
      await page.goto(`/${CC}/cart`)
      const totals = page.getByTestId("cart-totals")
      await expect(totals.getByTestId("cart-discount")).toBeVisible()
      const discount = await dataValue(totals.getByTestId("cart-discount"))
      expect(Math.abs(discount - 100), `cart-discount=${discount}`).toBeLessThanOrEqual(0.01)

      const rows =
        (await dataValue(totals.getByTestId("cart-subtotal"))) -
        discount +
        (await dataValue(totals.getByTestId("cart-shipping")))
      const grand = await dataValue(totals.getByTestId("cart-total"))
      expect(Math.abs(rows - grand), `rows=${rows} total=${grand}`).toBeLessThanOrEqual(0.01)
      await evidence("01-cart-fixed-100-vat-inclusive")
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, [promotionId && `/admin/promotions/${promotionId}`])
  }
})
