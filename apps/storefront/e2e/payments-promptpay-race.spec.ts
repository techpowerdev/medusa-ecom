import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Customer, Headers, adminHeaders, createCustomer, publishableKey, variantOf } from "./support/medusa"
import { HAS_STRIPE_SECRET, PROMPTPAY_PROVIDER, STRIPE_SECRET, retrievePaymentIntent } from "./support/stripe"

// PAY-5: spec 06 กฎข้อ 7 / AC-11 — race ระหว่าง QR PromptPay หมดอายุกับการชำระสำเร็จ (Stripe test mode จริง + webhook)
// ผลที่พบ: กรณี (b) — Medusa 2.22.1 ลบ session ได้แม้ PI `succeeded` (provider `deletePayment` ข้าม error ของ PI ที่ succeeded)
// แล้ว webhook หา session ไม่เจอ → เงินถูกตัดแต่ไม่มี order → ADR-015 (accepted: A + D) แก้ใน PAY-6; ระหว่างนี้ test เป็น fixme
// รันยืนยันปัญหาในเครื่องได้ด้วย E2E_RUN_KNOWN_ISSUES=1 (จะ fail จนกว่า PAY-6 merge)

const PRODUCT = "t-shirt"

async function storeCartWithPromptPay(request: APIRequestContext, pk: string, customer: Customer) {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const regions = await request.get(`${BACKEND_URL}/store/regions`, { headers })
  const regionId = (await regions.json()).regions[0].id
  const { variantId } = await variantOf(request, pk, PRODUCT)

  const created = await request.post(`${BACKEND_URL}/store/carts`, {
    headers,
    data: {
      region_id: regionId,
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
    },
  })
  expect(created.status(), "create cart").toBe(200)
  const cartId = (await created.json()).cart.id

  const options = await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, { headers })
  const standard = (await options.json()).shipping_options.find((o: { name: string }) => o.name === "Standard")
  const shipping = await request.post(`${BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
    headers,
    data: { option_id: standard.id },
  })
  expect(shipping.status(), "add shipping method").toBe(200)

  const pc = await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } })
  expect(pc.status(), "create payment collection").toBe(200)
  const collectionId = (await pc.json()).payment_collection.id
  const session = await newPromptPaySession(request, headers, collectionId)
  expect(session.status(), "create PromptPay session").toBe(200)
  const intentId = (await session.json()).payment_collection.payment_sessions[0].data.id as string
  return { cartId, collectionId, intentId, headers }
}

/** ขั้นหมดอายุแบบเดียวกับ storefront (`initiatePaymentSession` ด้วย provider เดิม) */
function newPromptPaySession(request: APIRequestContext, headers: Headers, collectionId: string) {
  return request.post(`${BACKEND_URL}/store/payment-collections/${collectionId}/payment-sessions`, {
    headers,
    data: { provider_id: PROMPTPAY_PROVIDER },
  })
}

/** confirm PI ฝั่ง server (test mode) ให้เป็น requires_action พร้อม QR — แทน confirmPromptPayPayment ของ Stripe.js */
async function confirmPromptPay(request: APIRequestContext, intentId: string, email: string) {
  const res = await request.post(`https://api.stripe.com/v1/payment_intents/${intentId}/confirm`, {
    headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    form: {
      "payment_method_data[type]": "promptpay",
      "payment_method_data[billing_details][email]": email,
    },
  })
  expect(res.status(), `confirm PaymentIntent ${intentId}`).toBe(200)
  return res.json()
}

/** payment_status ของ order ที่ payment อ้าง PI นี้ ("no-order" = เงินถูกตัดแต่ไม่มี order) */
async function orderStatusForIntent(request: APIRequestContext, admin: Headers, intentId: string) {
  const res = await request.get(
    `${BACKEND_URL}/admin/orders?fields=id,payment_status,*payment_collections.payments&limit=50&order=-created_at`,
    { headers: admin }
  )
  expect(res.status(), "list orders").toBe(200)
  const orders = (await res.json()).orders as {
    id: string
    payment_status: string
    payment_collections: { payments: { data: { id?: string } }[] }[]
  }[]
  const order = orders.find((o) =>
    o.payment_collections?.some((c) => c.payments?.some((p) => p.data?.id === intentId))
  )
  return order?.payment_status ?? "no-order"
}

test("AC-11: ชำระ PromptPay สำเร็จแล้วทันทีสร้าง session ใหม่ (หมดอายุ) → ยังได้ order captured ที่อ้าง PI นั้น", async ({
  page,
  request,
  step,
}) => {
  test.skip(!HAS_STRIPE_SECRET, "ต้องตั้ง STRIPE_API_KEY (sk_test_)")
  test.fixme(
    process.env.E2E_RUN_KNOWN_ISSUES !== "1",
    "กรณี (b) ของกฎข้อ 7 — Medusa ลบ session แม้ PI succeeded; แก้ใน PAY-6 (guard + alert) ตาม ADR-015 (docs/decisions/ADR-015-promptpay-paid-session-deleted.md)"
  )
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  let ctx!: Awaited<ReturnType<typeof storeCartWithPromptPay>>

  await step("Given cart ที่มี session PromptPay และ PI อยู่ requires_action", async () => {
    ctx = await storeCartWithPromptPay(request, pk, customer)
    const intent = await confirmPromptPay(request, ctx.intentId, customer.email)
    expect(intent.status).toBe("requires_action")
    await page.goto(intent.next_action.promptpay_display_qr_code.data)
  })

  await step("When ชำระสำเร็จ (authorize test payment) แล้วทันทีสร้าง session PromptPay ใหม่", async () => {
    await page.getByRole("button", { name: /authorize test payment/i }).click()
    // poll ถี่ๆ ให้ขั้นหมดอายุเกิดก่อน webhook payment_intent.succeeded มาถึง backend (race จริง)
    await expect
      .poll(async () => (await retrievePaymentIntent(request, ctx.intentId)).status, {
        timeout: 60_000,
        intervals: [200],
      })
      .toBe("succeeded")
    const res = await newPromptPaySession(request, ctx.headers, ctx.collectionId)
    // PAY-6: เมื่อมี guard ตาม ADR-015 แล้ว ให้เปลี่ยนเป็น expect(res.status()).toBe(409) + code PAYMENT_ALREADY_COMPLETED แทน console.log
    console.log(`[PAY-5] create new session after PI succeeded → HTTP ${res.status()}`)
  })

  await step("Then ภายใน 60 วินาที มี order captured ที่อ้าง PI ที่ succeeded (ไม่มีเงินค้างโดยไม่มี order)", async () => {
    expect((await retrievePaymentIntent(request, ctx.intentId)).status).toBe("succeeded")
    await expect
      .poll(() => orderStatusForIntent(request, admin, ctx.intentId), { timeout: 60_000, intervals: [2_000] })
      .toBe("captured")
  })
})
