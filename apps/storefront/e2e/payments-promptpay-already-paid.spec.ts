import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import {
  HAS_STRIPE_UI,
  PROMPTPAY_PROVIDER,
  cartIdOf,
  cartPaymentState,
  checkoutToPayment,
  continueToReview,
  retrievePaymentIntent,
  sessionIntentId,
} from "./support/stripe"

// PAY-6b: spec 06 AC-12 + AC-12b (ส่วน storefront), กฎข้อ 7A — QR หมดอายุแต่ลูกค้าชำระไปแล้ว (race)
// browser อ่านสถานะ PI ได้ค่าเก่า (mock เฉพาะ response ของ Stripe.js ให้เป็น requires_action) → storefront สร้าง session ใหม่
// → guard จริงของ backend ตอบ 409 PAYMENT_ALREADY_COMPLETED → แสดง promptpay-awaiting-order, เรียก complete cart ทางสำรอง
// และ poll จนไปหน้า order confirmed — ไม่แสดง promptpay-expired
// webhook ของ Medusa ถูกหน่วง 5 วินาที (`webhook_delay` default) จึงเป็นทางของ storefront ที่ complete cart ก่อนในเกือบทุกครั้ง
// ถ้า webhook มาพร้อมกัน lock `cart_id` ของ completeCartWorkflow ให้ได้ order เดียว (assert ด้านล่าง)
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-6b" } })

const PRODUCT = "t-shirt"

test("AC-12/AC-12b: หมดอายุหลังชำระแล้ว → 409 → รอสร้าง order → หน้า order confirmed (order เดียว captured)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน")
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  // จด test id ที่เคยแสดง (หน้าเปลี่ยนไป confirmed เร็ว จึงจับระหว่างทาง; exposeFunction อยู่รอดข้าม navigation)
  const seen = new Set<string>()
  await page.exposeFunction("__pay6bSeen", (id: string) => seen.add(id))
  await page.addInitScript(() => {
    const report = (window as unknown as { __pay6bSeen: (id: string) => void }).__pay6bSeen
    new MutationObserver(() => {
      for (const id of ["promptpay-awaiting-order", "promptpay-expired"]) {
        if (document.querySelector(`[data-testid="${id}"]`)) report(id)
      }
    }).observe(document, { childList: true, subtree: true })
  })

  await page.clock.install()
  await checkoutToPayment(page, context, request, pk, customer, CC, PRODUCT)
  const cartId = await cartIdOf(context)
  let intentId = ""

  await step("แสดง QR ของ PromptPay", async () => {
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await continueToReview(page)
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
    intentId = await sessionIntentId(request, pk, customer, cartId, PROMPTPAY_PROVIDER)
  })

  await step("ลูกค้าชำระสำเร็จ แต่ browser ยังเห็น PI เป็น requires_action (race)", async () => {
    await page.route(new RegExp(`api\\.stripe\\.com/v1/payment_intents/${intentId}\\?`), async (route) => {
      const res = await route.fetch()
      await route.fulfill({ response: res, json: { ...(await res.json()), status: "requires_action" } })
    })
    const intent = await retrievePaymentIntent(request, intentId)
    const bank = await context.newPage()
    await bank.goto(intent.next_action!.promptpay_display_qr_code!.data)
    await bank.getByRole("button", { name: /authorize test payment/i }).click()
    await expect
      .poll(async () => (await retrievePaymentIntent(request, intentId)).status, { timeout: 60_000, intervals: [200] })
      .toBe("succeeded")
    await bank.close()
  })

  await step("QR ครบ 10 นาที → guard ตอบ 409 → แสดง promptpay-awaiting-order แล้วไปหน้า order confirmed", async () => {
    await page.clock.fastForward("10:01")
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 90_000 })
    expect(Array.from(seen), "AC-12: แสดงรอสร้าง order และไม่แสดงหมดอายุ").toEqual(["promptpay-awaiting-order"])
  })

  await step("order เดียว captured ที่อ้าง PI เดิม และ session เดิมไม่ถูกแทน", async () => {
    const orderId = page.url().match(/\/order\/([^/]+)\/confirmed/)![1]
    const res = await request.get(
      `${BACKEND_URL}/admin/orders/${orderId}?fields=id,payment_status,*payment_collections.payments`,
      { headers: admin }
    )
    const { order } = await res.json()
    expect(order.payment_status).toBe("captured")
    const intents = order.payment_collections.flatMap((c: { payments: { data: { id: string } }[] }) =>
      c.payments.map((p) => p.data.id)
    )
    expect(intents).toEqual([intentId])
    const state = await cartPaymentState(request, pk, customer, cartId)
    expect(state.completed_at).not.toBeNull()
    expect(state.sessions.map((s) => s.data.id)).toEqual([intentId])
    await evidence("01-promptpay-already-paid-order-confirmed")
  })
})
