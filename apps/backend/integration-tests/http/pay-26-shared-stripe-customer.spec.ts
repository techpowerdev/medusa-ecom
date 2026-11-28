import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบเดียวกับ payment-collection-reset.spec.ts) — mock เฉพาะ network
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
const Customers = Stripe.resources.Customers.prototype
const PaymentIntents = Stripe.resources.PaymentIntents.prototype

const CARD = "pp_stripe_stripe"
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const ADDRESS = {
  first_name: "Somchai",
  last_name: "Jaidee",
  address_1: "1 Sukhumvit Rd",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

type HttpResult = { status: number; data: any }

// axios error มี circular reference — คืนเฉพาะ status/body (บทเรียนใน CLAUDE.md)
const settle = (request: Promise<{ status: number; data: any }>): Promise<HttpResult> =>
  request.then(
    (r) => ({ status: r.status, data: r.data }),
    (e) => ({ status: e.response?.status, data: e.response?.data })
  )

// PAY-26 (spec 01 กฎข้อ 157, AC-198, ADR-035): ลูกค้าสลับบัตร ↔ พร้อมเพย์หลังแก้ที่อยู่ได้ และใช้ Stripe customer ตัวเดียว
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let seq = 0

    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      const { data } = await api.get("/store/regions", { headers: { "x-publishable-api-key": pk } })
      regionId = data.regions[0].id
    })

    beforeEach(() => {
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      // กติกา idempotency ของ Stripe (24 ชม.): key เดิม + params เดิม → ผลเดิม; key เดิม + params ต่าง → StripeIdempotencyError
      const byKey = new Map<string, { params: string; customer: { id: string; object: string } }>()
      jest.spyOn(Customers, "create").mockImplementation(async (params: unknown, options?: { idempotencyKey?: string }) => {
        const key = options?.idempotencyKey
        const serialized = JSON.stringify(params)
        const seen = key ? byKey.get(key) : undefined
        if (seen) {
          if (seen.params !== serialized) {
            throw new Stripe.errors.StripeIdempotencyError({
              type: "idempotency_error",
              message:
                "Keys for idempotent requests can only be used with the same parameters they were first used with.",
            })
          }
          return seen.customer
        }
        const customer = { id: `cus_pay26_${++seq}`, object: "customer" }
        if (key) {
          byKey.set(key, { params: serialized, customer })
        }
        return customer
      })
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => ({
        id: `pi_pay26_${++seq}`,
        object: "payment_intent",
        currency: "thb",
        status: "requires_payment_method",
        amount: params.amount,
        customer: params.customer,
      }))
      jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => ({
        id,
        object: "payment_intent",
        status: "canceled",
      }))
      jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => ({
        id,
        object: "payment_intent",
        status: "requires_payment_method",
      }))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    async function newCustomer(tag: string) {
      const c = await registerCustomer(api, pk, `pay26-${tag}-${Date.now()}@example.com`, "pay26-password")
      return { id: c.customerId, auth: storeHeadersFor(pk, c.token) }
    }

    async function collectionFor(auth: { headers: Record<string, string> }) {
      const { data: products } = await api.get(`/store/products?region_id=${regionId}`, auth)
      const { data: cartRes } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          items: [{ variant_id: products.products[0].variants[0].id, quantity: 1 }],
          shipping_address: ADDRESS,
        },
        auth
      )
      const cartId = cartRes.cart.id
      const { data: options } = await api.get(`/store/shipping-options?cart_id=${cartId}`, auth)
      const standard = options.shipping_options.find((o) => o.name === "Standard")
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard.id }, auth)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, auth)
      return pc.payment_collection.id as string
    }

    const newSession = (collectionId: string, providerId: string, auth: { headers: Record<string, string> }) =>
      settle(api.post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: providerId }, auth))

    const addAddress = (auth: { headers: Record<string, string> }) =>
      api.post("/store/customers/me/addresses", { ...ADDRESS, is_default_billing: true }, auth)

    async function accountHolders(customerId: string) {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "customer",
        fields: ["id", "account_holders.provider_id", "account_holders.external_id"],
        filters: { id: customerId },
      })
      return (data[0]?.account_holders ?? []) as { provider_id: string; external_id: string }[]
    }

    async function switchAfterAddressChange(first: string, second: string) {
      const customer = await newCustomer(first === CARD ? "card" : "pp")
      const collectionId = await collectionFor(customer.auth)

      const created = await newSession(collectionId, first, customer.auth)
      expect(created.status).toEqual(200)
      expect(created.data.payment_collection.payment_sessions.map((s) => s.provider_id)).toEqual([first])

      await addAddress(customer.auth)

      const switched = await newSession(collectionId, second, customer.auth)
      expect({ status: switched.status, providers: switched.data.payment_collection?.payment_sessions?.map((s) => s.provider_id) }).toEqual({
        status: 200,
        providers: [second],
      })

      expect(Customers.create).toHaveBeenCalledTimes(1)
      const holders = await accountHolders(customer.id)
      expect(holders.map((h) => h.provider_id).sort()).toEqual([CARD, PROMPTPAY].sort())
      const [stripeCustomerId] = new Set(holders.map((h) => h.external_id))
      expect(new Set(holders.map((h) => h.external_id)).size).toEqual(1)
      expect(stripeCustomerId).toMatch(/^cus_pay26_/)

      const intents = (PaymentIntents.create as jest.Mock).mock.calls.map(([params]) => params)
      expect(intents).toHaveLength(2)
      expect(intents[1].customer).toEqual(stripeCustomerId)
      expect(intents[1].payment_method_types).toEqual(second === PROMPTPAY ? ["promptpay"] : undefined)
      return { customerId: customer.id }
    }

    it("(a)(c)(d) card → add address → PromptPay: 200, one Stripe customer, key per provider", async () => {
      const { customerId } = await switchAfterAddressChange(CARD, PROMPTPAY)
      expect((Customers.create as jest.Mock).mock.calls[0][1]).toEqual({ idempotencyKey: `${customerId}:stripe` })
    })

    it("(b)(c)(d) PromptPay → add address → card: 200, one Stripe customer, key per provider", async () => {
      const { customerId } = await switchAfterAddressChange(PROMPTPAY, CARD)
      expect((Customers.create as jest.Mock).mock.calls[0][1]).toEqual({
        idempotencyKey: `${customerId}:stripe-promptpay`,
      })
    })
  },
})
