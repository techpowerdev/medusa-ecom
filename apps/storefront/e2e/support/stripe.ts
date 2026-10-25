import { APIRequestContext, BrowserContext, FrameLocator, Page, expect } from "@playwright/test"

import { BACKEND_URL } from "./fixtures"
import { Customer, shippingOptionId } from "./medusa"

// PAY-2: อ่านผลจาก Stripe test mode ด้วย secret key จาก env (test key เท่านั้น) และพา checkout ไปถึงขั้น payment

export const STRIPE_SECRET = process.env.STRIPE_API_KEY ?? ""
export const STRIPE_PUBLISHABLE = process.env.NEXT_PUBLIC_STRIPE_KEY ?? ""
export const HAS_STRIPE_SECRET = STRIPE_SECRET.startsWith("sk_test_")
export const HAS_STRIPE_UI = HAS_STRIPE_SECRET && STRIPE_PUBLISHABLE.startsWith("pk_test_")

export const CARD_PROVIDER = "pp_stripe_stripe"
export const PROMPTPAY_PROVIDER = "pp_stripe-promptpay_stripe"

export type PaymentIntent = {
  id: string
  status: string
  payment_method_types: string[]
  next_action?: { promptpay_display_qr_code?: { data: string } } | null
}

export async function retrievePaymentIntent(request: APIRequestContext, id: string): Promise<PaymentIntent> {
  expect(HAS_STRIPE_SECRET, "ต้องใช้ Stripe test key (sk_test_) เท่านั้น").toBe(true)
  const res = await request.get(`https://api.stripe.com/v1/payment_intents/${id}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), `retrieve PaymentIntent ${id}`).toBe(200)
  return res.json()
}

export async function cartIdOf(context: BrowserContext): Promise<string> {
  const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  return cartId!
}

export type CartPaymentState = {
  completed_at: string | null
  sessions: { id: string; provider_id: string; status: string; data: { id?: string } }[]
}

/** payment session ปัจจุบันของ cart (store API ด้วย token ของลูกค้า) */
export async function cartPaymentState(
  request: APIRequestContext,
  pk: string,
  customer: Customer,
  cartId: string
): Promise<CartPaymentState> {
  const res = await request.get(
    `${BACKEND_URL}/store/carts/${cartId}?fields=+payment_collection.payment_sessions.data`,
    { headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk } }
  )
  expect(res.status(), "retrieve cart").toBe(200)
  const { cart } = await res.json()
  return { completed_at: cart.completed_at, sessions: cart.payment_collection?.payment_sessions ?? [] }
}

/** รอจน cart มี payment session ของ provider ที่มี PaymentIntent แล้ว คืน id ของ PaymentIntent */
export async function sessionIntentId(
  request: APIRequestContext,
  pk: string,
  customer: Customer,
  cartId: string,
  providerId: string
): Promise<string> {
  let id = ""
  await expect
    .poll(async () => {
      const { sessions } = await cartPaymentState(request, pk, customer, cartId)
      id = sessions.find((s) => s.provider_id === providerId)?.data?.id ?? ""
      return id
    }, { message: `payment session ${providerId}`, timeout: 15_000 })
    .toMatch(/^pi_/)
  return id
}

/** เพิ่มสินค้า → ที่อยู่ → Standard delivery แล้วหยุดที่ขั้น payment */
export async function checkoutToPayment(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  pk: string,
  customer: Customer,
  cc: string,
  product: string
) {
  await page.goto(`/${cc}/products/${product}`)
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.goto(`/${cc}/cart`)
  await expect(page.getByTestId("product-row")).toHaveCount(1)

  await page.getByTestId("checkout-button").click()
  await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()
  await page.getByTestId("shipping-first-name-input").fill("Somchai")
  await page.getByTestId("shipping-last-name-input").fill("Jaidee")
  await page.getByTestId("shipping-address-input").fill("1 Sukhumvit Rd")
  await page.getByTestId("shipping-postal-code-input").fill("10110")
  await page.getByTestId("shipping-city-input").fill("Bangkok")
  await page.getByTestId("shipping-country-select").selectOption(cc)
  await page.getByTestId("shipping-email-input").fill(customer.email)
  await page.getByTestId("submit-address-button").click()

  const standardId = await shippingOptionId(request, context, pk, customer, "Standard")
  await page.locator(`[data-testid="delivery-option-radio"][data-option-id="${standardId}"]`).click()
  await page.getByTestId("submit-delivery-option-button").click()
  await expect(page.getByTestId(`payment-option-${CARD_PROVIDER}`)).toBeVisible()
}

/** iframe ของ Stripe Payment Element (field ของบัตร) */
export function paymentElement(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Secure payment input frame"]')
}

export async function fillCard(page: Page, number: string) {
  const frame = paymentElement(page)
  await frame.locator('[name="number"]').fill(number)
  await frame.locator('[name="expiry"]').fill("12 / 34")
  await frame.locator('[name="cvc"]').fill("123")
}
