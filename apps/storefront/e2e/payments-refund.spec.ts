import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  variantOf,
} from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_SECRET, STRIPE_SECRET } from "./support/stripe"

// PAY-4: spec 06 AC-6 — admin refund ฿100 บน order ที่ captured (บัตร, Stripe test mode)
// refund ผ่านฟอร์มของ Medusa admin (POST /admin/payments/:id/refund → refundPaymentWorkflow) ไม่มีโค้ด refund ของเรา
// order สร้างผ่าน store API + confirm PaymentIntent ด้วยบัตรทดสอบ (ใช้แค่ secret key) — flow UI ของบัตรอยู่ใน AC-1 (PAY-2)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "payments", taskId: "PAY-4" } })

const REFUND_THB = 100

type Paid = { orderId: string; intentId: string }

async function storeCall(
  request: APIRequestContext,
  headers: Headers,
  path: string,
  data?: Record<string, unknown>
) {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** cart ของลูกค้า → session บัตร (pp_stripe_stripe) → confirm PI ด้วย pm_card_visa → complete → order captured */
async function placeCardOrder(request: APIRequestContext, pk: string, customer: Customer): Promise<Paid> {
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await storeCall(request, store, "/store/regions")
  const { variantId } = await variantOf(request, pk, "t-shirt")

  const { cart } = await storeCall(request, store, "/store/carts", {
    region_id: regions[0].id,
    email: customer.email,
    items: [{ variant_id: variantId, quantity: 1 }],
    shipping_address: {
      first_name: "Somchai",
      last_name: "Jaidee",
      address_1: "1 Sukhumvit Rd",
      city: "Bangkok",
      postal_code: "10110",
      country_code: "th",
    },
  })
  const { shipping_options } = await storeCall(request, store, `/store/shipping-options?cart_id=${cart.id}`)
  const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
  expect(standard, "shipping option Standard").toBeTruthy()
  await storeCall(request, store, `/store/carts/${cart.id}/shipping-methods`, { option_id: standard.id })

  const { payment_collection } = await storeCall(request, store, "/store/payment-collections", { cart_id: cart.id })
  const { payment_collection: withSession } = await storeCall(
    request,
    store,
    `/store/payment-collections/${payment_collection.id}/payment-sessions`,
    // เหมือน storefront (กฎข้อ 5, src/lib/util/payment-session.ts): session บัตรเป็น card เท่านั้น
    { provider_id: CARD_PROVIDER, data: { payment_method_types: ["card"] } }
  )
  const intentId: string = withSession.payment_sessions[0].data.id
  expect(intentId).toMatch(/^pi_/)

  const confirm = await request.post(`https://api.stripe.com/v1/payment_intents/${intentId}/confirm`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    form: { payment_method: "pm_card_visa" },
  })
  expect(confirm.status(), `confirm PaymentIntent: ${await confirm.text()}`).toBe(200)
  expect((await confirm.json()).status).toBe("succeeded")

  const done = await storeCall(request, store, `/store/carts/${cart.id}/complete`, {})
  expect(done.type, JSON.stringify(done)).toBe("order")
  return { orderId: done.order.id, intentId }
}

type AdminOrder = {
  payment_status: string
  total: number
  payment_collections: { payments: { id: string; amount: number; refunds: { amount: number }[] }[] }[]
}

async function adminOrder(request: APIRequestContext, admin: Headers, orderId: string): Promise<AdminOrder> {
  const res = await request.get(
    `${BACKEND_URL}/admin/orders/${orderId}?fields=id,payment_status,total,*payment_collections.payments,*payment_collections.payments.refunds`,
    { headers: admin }
  )
  expect(res.status()).toBe(200)
  return (await res.json()).order
}

type StripeRefund = { amount: number; currency: string; status: string }

async function stripeRefunds(request: APIRequestContext, intentId: string): Promise<StripeRefund[]> {
  const res = await request.get(`https://api.stripe.com/v1/refunds?payment_intent=${intentId}`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
  })
  expect(res.status(), "list Stripe refunds").toBe(200)
  return (await res.json()).data
}

test("AC-6: admin refund ฿100 บน order บัตรที่ captured → Stripe refund 10000 สตางค์, order แสดงสถานะ refund (partially_refunded)", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.skip(!HAS_STRIPE_SECRET, "ต้องตั้ง STRIPE_API_KEY (sk_test_)")
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const paid = await placeCardOrder(request, pk, customer)
  let paymentId = ""

  await step("order ชำระด้วยบัตรแล้ว payment_status=captured", async () => {
    await expect.poll(async () => (await adminOrder(request, admin, paid.orderId)).payment_status).toBe("captured")
    const order = await adminOrder(request, admin, paid.orderId)
    paymentId = order.payment_collections[0].payments[0].id
    expect(Number(order.total)).toBeGreaterThan(REFUND_THB)
  })

  await step("admin: เปิด order → Refund ของ payment → ใส่ ฿100 → Save", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${paid.orderId}`)
    const paymentRow = page.locator("div.grid").filter({ hasText: /Captured/ }).filter({ hasText: /Stripe/i })
    await expect(paymentRow).toHaveCount(1)
    await paymentRow.getByRole("button").last().click()
    await page.getByRole("menuitem", { name: "Refund" }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${paid.orderId}/refund\\?paymentId=${paymentId}`))

    const drawer = page.getByRole("dialog")
    const amount = drawer.locator("input").first()
    await amount.fill(String(REFUND_THB))
    await expect(amount).toHaveValue(/^100(\.00)?$/)
    // รอ animation เปิด drawer จบก่อนถ่าย evidence
    await expect.poll(() => drawer.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0)
    await evidence("01-admin-refund-form")
    await drawer.getByRole("button", { name: "Save" }).click()
    await expect(drawer).toBeHidden({ timeout: 30_000 })
  })

  await step("Medusa: refund ฿100 บน payment, order เป็น partially_refunded และ admin แสดงสถานะ", async () => {
    await expect
      .poll(async () => {
        const order = await adminOrder(request, admin, paid.orderId)
        return order.payment_collections[0].payments[0].refunds.map((r) => Number(r.amount))
      })
      .toEqual([REFUND_THB])
    // ฿100 น้อยกว่ายอด order → Medusa คำนวณเป็น partially_refunded (refund เต็มยอดจึงเป็น refunded)
    expect((await adminOrder(request, admin, paid.orderId)).payment_status).toBe("partially_refunded")
    await page.reload()
    await expect(page.getByText("Partially refunded").first()).toBeVisible()
    await evidence("02-admin-order-refunded")
  })

  await step("Stripe: มี refund 10000 สตางค์ (THB) สถานะ succeeded บน PaymentIntent ของ order", async () => {
    const refunds = await stripeRefunds(request, paid.intentId)
    expect(refunds).toHaveLength(1)
    expect(refunds[0]).toMatchObject({ amount: REFUND_THB * 100, currency: "thb", status: "succeeded" })
  })
})
