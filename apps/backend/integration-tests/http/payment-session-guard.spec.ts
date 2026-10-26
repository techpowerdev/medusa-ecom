import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, PaymentActions } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  processPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบเดียวกับ stripe-webhook.spec.ts) — mock เฉพาะ network
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

// PAY-6 (spec 06 กฎข้อ 7A, ADR-015 A + ภาคผนวก): guard ก่อนสร้าง payment session ใหม่ทับ session Stripe ที่ชำระแล้ว
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let owner: { headers: Record<string, string> }
    let ownerId: string
    let other: { headers: Record<string, string> }
    let piStatus: string
    let seq = 0

    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      const { data } = await api.get("/store/regions", { headers: { "x-publishable-api-key": pk } })
      regionId = data.regions[0].id
      const a = await registerCustomer(api, pk, "pay6-a@example.com", "pay6-password-a")
      const b = await registerCustomer(api, pk, "pay6-b@example.com", "pay6-password-b")
      owner = storeHeadersFor(pk, a.token)
      ownerId = a.customerId
      other = storeHeadersFor(pk, b.token)
    })

    let retrieve: jest.SpyInstance
    beforeEach(() => {
      piStatus = "requires_payment_method"
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      jest
        .spyOn(Stripe.resources.Customers.prototype, "create")
        .mockImplementation(async () => ({ id: "cus_pay6_test", object: "customer" }))
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => ({
        id: `pi_pay6_${++seq}`,
        object: "payment_intent",
        amount: params.amount,
        currency: "thb",
        status: "requires_payment_method",
        metadata: params.metadata,
      }))
      const intent = (id: string, status: string) => ({ id, object: "payment_intent", currency: "thb", status })
      jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => intent(id, "canceled"))
      retrieve = jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => intent(id, piStatus))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const newSession = (collectionId: string, providerId: string, headers = owner) =>
      api.post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: providerId }, headers)

    async function cartWithSession(providerId: string) {
      const { data: products } = await api.get(`/store/products?region_id=${regionId}`, owner)
      const { data: cartRes } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          items: [{ variant_id: products.products[0].variants[0].id, quantity: 1 }],
          shipping_address: ADDRESS,
        },
        owner
      )
      const cartId = cartRes.cart.id
      const { data: options } = await api.get(`/store/shipping-options?cart_id=${cartId}`, owner)
      const standard = options.shipping_options.find((o) => o.name === "Standard")
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard.id }, owner)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, owner)
      const collectionId = pc.payment_collection.id
      const { data } = await newSession(collectionId, providerId)
      return { cartId, collectionId, session: data.payment_collection.payment_sessions[0] }
    }

    async function collectionState(collectionId: string) {
      const { data } = await getContainer()
        .resolve("query")
        .graph({
          entity: "payment_collection",
          fields: ["payment_sessions.id", "payments.id", "payments.captures.id"],
          filters: { id: collectionId },
        })
      return {
        sessionIds: data[0].payment_sessions.map((s) => s?.id),
        payments: data[0].payments.map((p) => ({ id: p?.id, captures: p?.captures ?? [] })),
      }
    }

    async function ordersForCart(cartId: string) {
      const { data } = await getContainer()
        .resolve("query")
        .graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })
      return data
    }

    async function paymentStatus(orderId: string) {
      const { data } = await api.get(`/store/orders/${orderId}?fields=id,payment_status`, owner)
      return data.order.payment_status
    }

    const captured = (session: { id: string; amount: number }) =>
      processPaymentWorkflow(getContainer()).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount } },
      })

    async function expectConflict(request: Promise<unknown>) {
      const res = await request.then(
        (r: any) => ({ status: r.status, data: r.data }),
        (e) => ({ status: e.response?.status, data: e.response?.data })
      )
      expect(res).toEqual({
        status: 409,
        data: { type: "conflict", code: "PAYMENT_ALREADY_COMPLETED", message: expect.any(String) },
      })
    }

    describe.each([
      { providerId: PROMPTPAY, status: "succeeded" },
      { providerId: CARD, status: "succeeded" },
      { providerId: CARD, status: "requires_capture" },
    ])("$providerId with PI $status", ({ providerId, status }) => {
      it("(a) answers 409 and keeps the paid session instead of replacing it", async () => {
        const { collectionId, session } = await cartWithSession(providerId)
        piStatus = status

        await expectConflict(newSession(collectionId, providerId))

        const state = await collectionState(collectionId)
        expect(state.sessionIds).toEqual([session.id])
        expect(state.payments).toHaveLength(1)
        expect(PaymentIntents.cancel).not.toHaveBeenCalled()
      })
    })

    it("(b) answers 409 without asking the provider when the session is already authorized", async () => {
      const { collectionId, session } = await cartWithSession(PROMPTPAY)
      piStatus = "succeeded"
      await getContainer().resolve(Modules.PAYMENT).authorizePaymentSession(session.id, {})
      retrieve.mockClear()

      await expectConflict(newSession(collectionId, PROMPTPAY))
      expect(retrieve).not.toHaveBeenCalled()
      expect((await collectionState(collectionId)).sessionIds).toEqual([session.id])
    })

    it.each(["requires_action", "requires_payment_method", "canceled"])(
      "(c) creates a new session as Medusa does when the PI is %s",
      async (status) => {
        const { collectionId, session } = await cartWithSession(PROMPTPAY)
        piStatus = status

        const { status: httpStatus, data } = await newSession(collectionId, PROMPTPAY)
        expect(httpStatus).toEqual(200)
        expect(data.payment_collection.payment_sessions).toHaveLength(1)
        expect(data.payment_collection.payment_sessions[0].id).not.toEqual(session.id)
      }
    )

    it("(d) fails closed and keeps the session when the provider errors", async () => {
      const { collectionId, session } = await cartWithSession(PROMPTPAY)
      retrieve.mockImplementation(async () => {
        throw new Error("Stripe is down")
      })

      const res = await newSession(collectionId, PROMPTPAY).catch((e) => e.response)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect((await collectionState(collectionId)).sessionIds).toEqual([session.id])
    })

    it("(e) does not ask the provider for a pp_system_default session", async () => {
      const { collectionId } = await cartWithSession("pp_system_default")

      const { status } = await newSession(collectionId, PROMPTPAY)
      expect(status).toEqual(200)
      expect(retrieve).not.toHaveBeenCalled()
    })

    it("(g) runs after auth and ownership: no token → 401, another customer → 404 without authorizing", async () => {
      const { collectionId, session } = await cartWithSession(PROMPTPAY)
      piStatus = "succeeded"

      const anonymous = await newSession(collectionId, PROMPTPAY, storeHeadersFor(pk)).catch((e) => e.response)
      expect(anonymous.status).toEqual(401)
      const stranger = await newSession(collectionId, PROMPTPAY, other).catch((e) => e.response)
      expect(stranger.status).toEqual(404)

      expect(retrieve).not.toHaveBeenCalled()
      const state = await collectionState(collectionId)
      expect(state.sessionIds).toEqual([session.id])
      expect(state.payments).toHaveLength(0)
    })

    it("AC-14: after 409 the captured webhook completes the cart once; replaying it adds no capture or order", async () => {
      const { cartId, collectionId, session } = await cartWithSession(PROMPTPAY)
      piStatus = "succeeded"
      await expectConflict(newSession(collectionId, PROMPTPAY))

      await captured(session)
      await captured(session)

      const orders = await ordersForCart(cartId)
      expect(orders).toHaveLength(1)
      expect(await paymentStatus(orders[0].order_id)).toEqual("captured")
      const { payments } = await collectionState(collectionId)
      expect(payments).toHaveLength(1)
      expect(payments[0].captures).toHaveLength(1)
    })

    it("AC-12b: after 409 completing the cart (fallback) together with the webhook yields one captured order", async () => {
      const { cartId, collectionId, session } = await cartWithSession(PROMPTPAY)
      piStatus = "succeeded"
      await expectConflict(newSession(collectionId, PROMPTPAY))

      const [completed] = await Promise.allSettled([
        api.post(`/store/carts/${cartId}/complete`, {}, owner),
        captured(session),
      ])
      if (completed.status === "fulfilled") {
        expect(completed.value.data.type).toEqual("order")
      }
      // ทางสำรองเรียกซ้ำหลังมี order แล้วได้ order เดิม
      const { data: again } = await api.post(`/store/carts/${cartId}/complete`, {}, owner)
      expect(again.type).toEqual("order")

      const orders = await ordersForCart(cartId)
      expect(orders).toHaveLength(1)
      expect(again.order.id).toEqual(orders[0].order_id)
      expect(await paymentStatus(orders[0].order_id)).toEqual("captured")
      const { payments } = await collectionState(collectionId)
      expect(payments).toHaveLength(1)
      expect(payments[0].captures).toHaveLength(1)
    })

    describe("order payment collection (no cart, ADR-015 appendix)", () => {
      async function orderCollectionWithSession() {
        const { result: order } = await createOrderWorkflow(getContainer()).run({
          input: {
            region_id: regionId,
            customer_id: ownerId,
            email: "pay6-a@example.com",
            currency_code: "thb",
            items: [{ title: "Group buy item", quantity: 1, unit_price: 590 }],
          },
        })
        const { result } = await createOrderPaymentCollectionWorkflow(getContainer()).run({
          input: { order_id: order.id, amount: 590 },
        })
        const collectionId = result[0].id
        const { data } = await newSession(collectionId, PROMPTPAY)
        return { collectionId, session: data.payment_collection.payment_sessions[0] }
      }

      it("another customer gets 404 without authorizing", async () => {
        const { collectionId } = await orderCollectionWithSession()
        piStatus = "succeeded"

        const stranger = await newSession(collectionId, PROMPTPAY, other).catch((e) => e.response)
        expect(stranger.status).toEqual(404)
        expect(retrieve).not.toHaveBeenCalled()
      })

      it("guard and captured webhook at the same time create a single payment on the collection", async () => {
        const { collectionId, session } = await orderCollectionWithSession()
        piStatus = "succeeded"

        const [guard] = await Promise.allSettled([newSession(collectionId, PROMPTPAY), captured(session)])
        expect(guard.status).toEqual("rejected")
        await captured(session).catch(() => undefined)

        const state = await collectionState(collectionId)
        expect(state.sessionIds).toEqual([session.id])
        expect(state.payments).toHaveLength(1)
        expect(state.payments[0].captures).toHaveLength(1)
      })
    })
  },
})
