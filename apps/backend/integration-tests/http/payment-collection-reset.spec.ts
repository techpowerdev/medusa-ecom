import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  refundPaymentAndRecreatePaymentSessionWorkflow,
  refundPaymentsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบเดียวกับ payment-session-guard.spec.ts) — mock เฉพาะ network
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

type HttpResult = { status: number; data: any }

// axios error มี circular reference — คืนเฉพาะ status/body (บทเรียนใน CLAUDE.md)
const settle = (request: Promise<{ status: number; data: any }>): Promise<HttpResult> =>
  request.then(
    (r) => ({ status: r.status, data: r.data }),
    (e) => ({ status: e.response?.status, data: e.response?.data })
  )

const resetConflict = {
  status: 409,
  data: { type: "conflict", code: "PAYMENT_COLLECTION_RESET", message: expect.any(String) },
}

// PAY-9 (spec 06 กฎข้อ 11, AC-22 a/b, ADR-025): collection ของ cart ที่ถูกคืนเงินครบ (ผลของ compensatePaymentIfNeededStep)
// ถูกถอด link cart ↔ collection แล้วตอบ 409 PAYMENT_COLLECTION_RESET — cart จ่ายใหม่ได้ด้วย collection ชุดใหม่
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let owner: { headers: Record<string, string> }
    let ownerId: string
    let seq = 0

    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      const { data } = await api.get("/store/regions", { headers: { "x-publishable-api-key": pk } })
      regionId = data.regions[0].id
      const a = await registerCustomer(api, pk, "pay9-a@example.com", "pay9-password-a")
      owner = storeHeadersFor(pk, a.token)
      ownerId = a.customerId
    })

    beforeEach(() => {
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      jest
        .spyOn(Stripe.resources.Customers.prototype, "create")
        .mockImplementation(async () => ({ id: "cus_pay9_test", object: "customer" }))
      const intent = (id: string, status: string, amount?: number) => ({
        id,
        object: "payment_intent",
        currency: "thb",
        status,
        amount,
        amount_received: status === "succeeded" ? amount : 0,
      })
      jest
        .spyOn(PaymentIntents, "create")
        .mockImplementation(async (params: any) => intent(`pi_pay9_${++seq}`, "requires_payment_method", params.amount))
      // ลูกค้าจ่ายสำเร็จแล้ว (บัตร/PromptPay) — authorize ได้ captured
      jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => intent(id, "succeeded"))
      jest.spyOn(PaymentIntents, "capture").mockImplementation(async (id: string) => intent(id, "succeeded"))
      jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => intent(id, "canceled"))
      jest
        .spyOn(Stripe.resources.Refunds.prototype, "create")
        .mockImplementation(async (params: any) => ({ id: `re_pay9_${++seq}`, object: "refund", status: "succeeded", ...params }))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const query = () => getContainer().resolve("query")

    const newSession = (collectionId: string, providerId = CARD) =>
      settle(api.post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: providerId }, owner))

    async function cartWithSession(providerId = CARD) {
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
      const created = await newSession(collectionId, providerId)
      expect(created.status).toEqual(200)
      return { cartId, collectionId, session: created.data.payment_collection.payment_sessions[0] }
    }

    // ลูกค้าจ่ายแล้ว (authorize → captured) — คืน payment ที่ capture แล้ว
    async function pay(session: { id: string }) {
      const payment = await getContainer().resolve(Modules.PAYMENT).authorizePaymentSession(session.id, {})
      const { data } = await query().graph({
        entity: "payment",
        fields: ["id", "amount", "captures.id"],
        filters: { id: payment!.id },
      })
      expect(data[0].captures).toHaveLength(1)
      return data[0]
    }

    // จำลองผลของ compensatePaymentIfNeededStep (Medusa 2.22.1): คืนเงินเต็มจำนวนด้วย refundPaymentsWorkflow
    const refundAll = (payment: { id: string; amount: unknown }) =>
      refundPaymentsWorkflow(getContainer()).run({
        input: [{ payment_id: payment.id, amount: payment.amount as number }],
      })

    async function cartCollectionIds(cartId: string) {
      const { data } = await query().graph({
        entity: "cart_payment_collection",
        fields: ["payment_collection_id"],
        filters: { cart_id: cartId },
      })
      return data.map((row) => row.payment_collection_id)
    }

    async function refundedCart() {
      const { cartId, collectionId, session } = await cartWithSession()
      await refundAll(await pay(session))
      return { cartId, collectionId }
    }

    it("(a) refunded cart collection → 409 PAYMENT_COLLECTION_RESET, link dismissed, old collection keeps its refund", async () => {
      const { cartId, collectionId } = await refundedCart()

      expect(await newSession(collectionId)).toEqual(resetConflict)

      expect(await cartCollectionIds(cartId)).toEqual([])
      const { data } = await query().graph({
        entity: "payment_collection",
        fields: ["id", "payments.refunds.id"],
        filters: { id: collectionId },
      })
      expect(data).toHaveLength(1)
      expect(data[0].payments).toHaveLength(1)
      expect(data[0].payments[0].refunds).toHaveLength(1)
      expect(Stripe.resources.Refunds.prototype.create).toHaveBeenCalledTimes(1) // middleware ไม่คืนเงินซ้ำ
    })

    it("(a) O-2 state: compensation deleted the refunded session → still reset (guardPaidStripeSession would let it through)", async () => {
      const { cartId, collectionId, session } = await cartWithSession()
      await refundAll(await pay(session))
      // createPaymentSessionsWorkflow ใน refundPaymentAndRecreatePaymentSessionWorkflow ลบ session เดิมก่อนสร้างใหม่ (ล้ม billing_details)
      await getContainer().resolve(Modules.PAYMENT).deletePaymentSession(session.id)

      expect(await newSession(collectionId)).toEqual(resetConflict)
      expect(await cartCollectionIds(cartId)).toEqual([])
    })

    it("(a) two concurrent requests both get 409 PAYMENT_COLLECTION_RESET without 5xx", async () => {
      const { cartId, collectionId } = await refundedCart()

      const results = await Promise.all([newSession(collectionId), newSession(collectionId)])

      expect(results).toEqual([resetConflict, resetConflict])
      expect(await cartCollectionIds(cartId)).toEqual([])
    })

    it("(a) after the reset the cart pays with a new collection → order has 1 collection and payment_status captured", async () => {
      const { cartId, collectionId } = await refundedCart()
      expect(await newSession(collectionId)).toEqual(resetConflict)

      // storefront: cart ไม่มี collection แล้ว → สร้างใหม่ด้วย route ของ Medusa แล้วสร้าง session อีกครั้ง
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, owner)
      const newCollectionId = pc.payment_collection.id
      expect(newCollectionId).not.toEqual(collectionId)
      expect((await newSession(newCollectionId)).status).toEqual(200)

      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, owner)
      expect(completed.type).toEqual("order")

      const { data: orders } = await query().graph({
        entity: "order",
        fields: ["id", "payment_collections.id"],
        filters: { id: completed.order.id },
      })
      expect(orders[0].payment_collections.map((c) => c?.id)).toEqual([newCollectionId])
      const { data: storeOrder } = await api.get(`/store/orders/${completed.order.id}?fields=id,payment_status`, owner)
      expect(storeOrder.order.payment_status).toEqual("captured")
    })

    it("(b) captured payment not refunded → not reset (PAY-6 guard answers PAYMENT_ALREADY_COMPLETED as in AC-13)", async () => {
      const { cartId, collectionId, session } = await cartWithSession(PROMPTPAY)
      await pay(session)

      const res = await newSession(collectionId, PROMPTPAY)
      expect(res.status).toEqual(409)
      expect(res.data.code).toEqual("PAYMENT_ALREADY_COMPLETED")
      expect(await cartCollectionIds(cartId)).toEqual([collectionId])
    })

    it("(b) refunded collection that still has a session without a payment (paid, webhook not yet arrived) → not reset", async () => {
      const { cartId, collectionId, session } = await cartWithSession()
      await refundAll(await pay(session))
      // session ใหม่ที่ลูกค้าอาจจ่ายแล้วแต่ webhook ยังไม่มา (สร้างตรงที่ payment module — route ของ Medusa จะลบ session เดิม)
      const pending = await getContainer()
        .resolve(Modules.PAYMENT)
        .createPaymentSession(collectionId, { provider_id: CARD, amount: session.amount, currency_code: "thb", data: {} })

      const res = await newSession(collectionId)
      expect(res.data?.code).not.toEqual("PAYMENT_COLLECTION_RESET")
      expect(await cartCollectionIds(cartId)).toEqual([collectionId])
      const { data } = await query().graph({
        entity: "payment_collection",
        fields: ["payment_sessions.id"],
        filters: { id: collectionId },
      })
      expect(data[0].payment_sessions.map((s) => s?.id)).toContain(pending.id)
    })

    // characterization test (qa #445 D-1 — session หลักตัดสิน 2026-11-21 ให้คงพฤติกรรมนี้):
    // ถ้า recreate ใน compensatePaymentIfNeededStep สำเร็จ (ทำได้กับ pp_system_default; กับ Stripe ใน 2.22.1 ล้มเสมอ —
    // medusajs/medusa#17948) collection เดิมจะมี session ใหม่ที่ไม่มี payment → guard ของ review #445 ไม่ reset
    // → จ่ายใหม่ใน collection เดิม = อาการ O-2/#69 กลับมา; test นี้ล้มเมื่อพฤติกรรมเปลี่ยน → ทบทวน ADR-025 เมื่อ bump Medusa/#17948 ถูกแก้
    it("(D-1) Medusa recreate succeeds after the refund → pending session in the old collection → not reset", async () => {
      const { cartId, collectionId, session } = await cartWithSession("pp_system_default")
      const paymentModule = getContainer().resolve(Modules.PAYMENT)
      const payment = await paymentModule.authorizePaymentSession(session.id, {})
      await paymentModule.capturePayment({ payment_id: payment!.id })

      // input แบบเดียวกับ compensatePaymentIfNeededStep (core-flows 2.22.1 cart/steps/compensate-payment-if-needed.js)
      await refundPaymentAndRecreatePaymentSessionWorkflow(getContainer()).run({
        input: {
          payment_collection_id: collectionId,
          provider_id: "pp_system_default",
          customer_id: ownerId,
          data: session.data ?? {},
          amount: session.amount,
          payment_id: payment!.id,
          note: "Refunded due to cart completion failure",
        },
      })
      const { data: before } = await query().graph({
        entity: "payment_collection",
        fields: ["payment_sessions.id", "payment_sessions.payment.id", "payments.refunds.id"],
        filters: { id: collectionId },
      })
      expect(before[0].payments[0].refunds).toHaveLength(1)
      expect(before[0].payment_sessions.some((s) => !s?.payment?.id)).toBe(true)

      const res = await newSession(collectionId, "pp_system_default")
      expect(res.data?.code).not.toEqual("PAYMENT_COLLECTION_RESET")
      expect(await cartCollectionIds(cartId)).toEqual([collectionId])
    })

    it("(b) order collection (group buy) fully refunded → not reset", async () => {
      const { result: order } = await createOrderWorkflow(getContainer()).run({
        input: {
          region_id: regionId,
          customer_id: ownerId,
          email: "pay9-a@example.com",
          currency_code: "thb",
          items: [{ title: "Group buy item", quantity: 1, unit_price: 590 }],
        },
      })
      const { result } = await createOrderPaymentCollectionWorkflow(getContainer()).run({
        input: { order_id: order.id, amount: 590 },
      })
      const collectionId = result[0].id
      const created = await newSession(collectionId, PROMPTPAY)
      expect(created.status).toEqual(200)
      await refundAll(await pay(created.data.payment_collection.payment_sessions[0]))

      const res = await newSession(collectionId, PROMPTPAY)
      expect(res.data?.code).not.toEqual("PAYMENT_COLLECTION_RESET")
      const { data } = await query().graph({
        entity: "order_payment_collection",
        fields: ["payment_collection_id"],
        filters: { order_id: order.id },
      })
      expect(data.map((row) => row.payment_collection_id)).toEqual([collectionId])
    })
  },
})
