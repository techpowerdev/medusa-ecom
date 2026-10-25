import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(180 * 1000)

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (transitive dependency ไม่ได้เพิ่ม dependency ใหม่)
// mock เฉพาะการเรียก network ไป Stripe; signature ของ webhook ยังถูกตรวจจริงด้วย STRIPE_WEBHOOK_SECRET
const stripeSdkPath = require.resolve("stripe", {
  paths: [
    path.dirname(
      require.resolve("@medusajs/payment-stripe/package.json", {
        paths: [require.resolve("@medusajs/medusa/package.json")],
      })
    ),
  ],
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require(stripeSdkPath)
const PaymentIntents = Stripe.resources.PaymentIntents.prototype

const CUSTOMER_EMAIL = "pay1-buyer@example.com"
const CUSTOMER_PASSWORD = "pay1-test-password"

type Intent = Record<string, unknown> & { id: string; amount: number; status: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function signedWebhook(event: Record<string, unknown>) {
  const payload = JSON.stringify(event)
  const header = new Stripe("sk_test_signing_only").webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  return { payload, headers: { "content-type": "application/json", "stripe-signature": header } }
}

function intentEvent(type: string, intent: Record<string, unknown>) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: { object: intent },
  }
}

// PAY-1: ตั้งค่า Stripe provider ของ Medusa (บัตร + PromptPay) และ webhook route (spec 06, AC-8)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let storeHeaders: { headers: Record<string, string> }

    // ต้องอยู่ใน beforeAll ระดับบนสุด: test runner snapshot DB หลัง hook นี้และ restore ก่อนทุก test
    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      const { data } = await api.get("/store/regions", { headers: { "x-publishable-api-key": pk } })
      regionId = data.regions[0].id

      const { data: reg } = await api.post("/auth/customer/emailpass/register", {
        email: CUSTOMER_EMAIL,
        password: CUSTOMER_PASSWORD,
      })
      await api.post(
        "/store/customers",
        { email: CUSTOMER_EMAIL },
        { headers: { authorization: `Bearer ${reg.token}`, "x-publishable-api-key": pk } }
      )
      const { data: login } = await api.post("/auth/customer/emailpass", {
        email: CUSTOMER_EMAIL,
        password: CUSTOMER_PASSWORD,
      })
      storeHeaders = {
        headers: { authorization: `Bearer ${login.token}`, "x-publishable-api-key": pk },
      }
    })

    beforeEach(() => {
      // CI ไม่มี Stripe key: การเรียก Stripe ที่ไม่ได้ mock ต้อง fail ทันที ไม่ออก network
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      jest
        .spyOn(Stripe.resources.Customers.prototype, "create")
        .mockImplementation(async () => ({ id: "cus_pay1_test", object: "customer" }))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("registers Stripe card and PromptPay providers and enables both in region Thailand", async () => {
      const { data } = await api.get(`/store/payment-providers?region_id=${regionId}`, {
        headers: { "x-publishable-api-key": pk },
      })
      const ids = data.payment_providers.map((p) => p.id)
      expect(ids).toEqual(
        expect.arrayContaining(["pp_stripe_stripe", "pp_stripe-promptpay_stripe"])
      )
    })

    async function cartWithSession(providerId: string) {
      const { data: products } = await api.get(`/store/products?region_id=${regionId}`, storeHeaders)
      const { data: cartRes } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          email: CUSTOMER_EMAIL,
          items: [{ variant_id: products.products[0].variants[0].id, quantity: 1 }],
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit Rd",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
        },
        storeHeaders
      )
      const cartId = cartRes.cart.id
      const { data: options } = await api.get(`/store/shipping-options?cart_id=${cartId}`, storeHeaders)
      const standard = options.shipping_options.find((o) => o.name === "Standard")
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard.id }, storeHeaders)

      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, storeHeaders)
      const { data: withSession } = await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: providerId },
        storeHeaders
      )
      const session = withSession.payment_collection.payment_sessions[0]
      return { cartId, session }
    }

    async function ordersForCart(cartId: string) {
      const query = getContainer().resolve("query")
      const { data } = await query.graph({
        entity: "order_cart",
        fields: ["order_id"],
        filters: { cart_id: cartId },
      })
      return data
    }

    async function waitForOrder(cartId: string, timeoutMs = 30000) {
      const until = Date.now() + timeoutMs
      while (Date.now() < until) {
        const links = await ordersForCart(cartId)
        if (links.length) {
          return links
        }
        await sleep(500)
      }
      return []
    }

    describe.each([
      { providerId: "pp_stripe_stripe", hook: "/hooks/payment/stripe_stripe" },
      { providerId: "pp_stripe-promptpay_stripe", hook: "/hooks/payment/stripe-promptpay_stripe" },
    ])("POST $hook (AC-8)", ({ providerId, hook }) => {
      it("creates exactly one order with one capture when the same succeeded event is delivered repeatedly", async () => {
        const intent: Intent = {
          id: "pi_pay1_test",
          object: "payment_intent",
          amount: 0,
          currency: "thb",
          status: "requires_payment_method",
          metadata: {},
        }
        const create = jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => {
          Object.assign(intent, { amount: params.amount, metadata: params.metadata })
          return { ...intent }
        })
        const succeeded = () => ({ ...intent, status: "succeeded", amount_received: intent.amount })
        const retrieve = jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async () => succeeded())
        const capture = jest.spyOn(PaymentIntents, "capture").mockImplementation(async () => succeeded())

        const { cartId, session } = await cartWithSession(providerId)
        expect(session.provider_id).toEqual(providerId)
        expect(create).toHaveBeenCalledTimes(1)
        // ADR-007: capture อัตโนมัติ และไม่เปิด automatic payment methods
        expect(create.mock.calls[0][0]).toMatchObject({
          capture_method: "automatic",
          currency: "thb",
          metadata: { session_id: session.id },
        })
        expect((create.mock.calls[0][0] as any).automatic_payment_methods).toBeUndefined()

        const webhook = signedWebhook(intentEvent("payment_intent.succeeded", succeeded()))
        const deliveries = await Promise.all([
          api.post(hook, webhook.payload, { headers: webhook.headers }),
          api.post(hook, webhook.payload, { headers: webhook.headers }),
        ])
        deliveries.forEach((res) => expect(res.status).toEqual(200))

        const links = await waitForOrder(cartId)
        expect(links).toHaveLength(1)

        // Stripe ส่ง event เดิมซ้ำอีกครั้งหลัง order ถูกสร้างแล้ว
        const late = await api.post(hook, webhook.payload, { headers: webhook.headers })
        expect(late.status).toEqual(200)
        await sleep(8000)

        expect(await ordersForCart(cartId)).toHaveLength(1)
        const { data: storeOrder } = await api.get(
          `/store/orders/${links[0].order_id}?fields=id,payment_status`,
          storeHeaders
        )
        expect(storeOrder.order.payment_status).toEqual("captured")

        const query = getContainer().resolve("query")
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "payment_collections.payments.captures.id", "payment_collections.payments.refunds.id"],
          filters: { id: links[0].order_id },
        })
        const payments = orders[0].payment_collections.flatMap((c) => c.payments)
        expect(payments).toHaveLength(1)
        expect(payments[0].captures).toHaveLength(1)
        expect(payments[0].refunds ?? []).toHaveLength(0)
        expect(retrieve).toHaveBeenCalled()
        expect(capture.mock.calls.length).toBeLessThanOrEqual(1)
      })

      it("ignores events with an invalid signature", async () => {
        jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => ({
          id: "pi_pay1_forged",
          object: "payment_intent",
          amount: params.amount,
          currency: "thb",
          status: "requires_payment_method",
          metadata: params.metadata,
        }))
        const retrieve = jest.spyOn(PaymentIntents, "retrieve")
        const { cartId, session } = await cartWithSession(providerId)

        const payload = JSON.stringify(
          intentEvent("payment_intent.succeeded", {
            id: "pi_pay1_forged",
            amount: 59000,
            amount_received: 59000,
            currency: "thb",
            status: "succeeded",
            metadata: { session_id: session.id },
          })
        )
        await api.post(hook, payload, {
          headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forged" },
        })
        await sleep(8000)

        expect(await ordersForCart(cartId)).toHaveLength(0)
        expect(retrieve).not.toHaveBeenCalled()
      })
    })
  },
})
