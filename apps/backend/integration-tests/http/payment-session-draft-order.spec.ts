import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, PaymentActions } from "@medusajs/framework/utils"
import {
  createOrderWorkflow,
  createOrUpdateOrderPaymentCollectionWorkflow,
  processPaymentWorkflow,
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

const PROMPTPAY = "pp_stripe-promptpay_stripe"

// PAY-3a (spec 06 กฎข้อ 9c, AC-18, ภาคผนวก ADR-015): หน้า /account/orders/:id/pay สร้าง session ด้วย route ของ Medusa
// บน payment collection ของ draft order (group buy) — ownership ของ CORE-12 และ guard ของ PAY-6 ต้องใช้กับ collection นี้ด้วย
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let ownerId: string
    let owner: { headers: Record<string, string> }
    let other: { headers: Record<string, string> }
    let piStatus: string
    let seq = 0

    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      const { data } = await api.get("/store/regions", { headers: { "x-publishable-api-key": pk } })
      regionId = data.regions[0].id
      const a = await registerCustomer(api, pk, "pay3a-a@example.com", "pay3a-password-a")
      const b = await registerCustomer(api, pk, "pay3a-b@example.com", "pay3a-password-b")
      ownerId = a.customerId
      owner = storeHeadersFor(pk, a.token)
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
        .mockImplementation(async () => ({ id: "cus_pay3a_test", object: "customer" }))
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => ({
        id: `pi_pay3a_${++seq}`,
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

    // draft order DA ของ A แบบเดียวกับ createGroupDraftOrderStep (GB-3) + collection ที่ Medusa คำนวณยอดจาก summary
    async function draftOrderCollection() {
      const { result: order } = await createOrderWorkflow(getContainer()).run({
        input: {
          is_draft_order: true,
          status: "pending",
          region_id: regionId,
          customer_id: ownerId,
          email: "pay3a-a@example.com",
          currency_code: "thb",
          items: [{ title: "Group buy item", quantity: 1, unit_price: 590 }],
        } as any,
      })
      const { result } = await createOrUpdateOrderPaymentCollectionWorkflow(getContainer()).run({
        input: { order_id: order.id },
      })
      return { orderId: order.id, collectionId: (result as any[])[0].id as string }
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

    // payment ที่ deleted_at IS NULL ของ session (unique index IDX_payment_payment_session_id_unique)
    async function livePayments(sessionId: string) {
      return getContainer().resolve(Modules.PAYMENT).listPayments({ payment_session_id: sessionId })
    }

    const captured = (session: { id: string; amount: number }) =>
      processPaymentWorkflow(getContainer()).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount } },
      })

    it("AC-18: the draft order's collection is linked to the order and has no cart", async () => {
      const { orderId, collectionId } = await draftOrderCollection()
      const { data } = await getContainer()
        .resolve("query")
        .graph({
          entity: "payment_collection",
          fields: ["id", "cart.id", "order.id", "order.is_draft_order"],
          filters: { id: collectionId },
        })
      expect(data[0].cart).toBeFalsy()
      expect(data[0].order).toEqual(expect.objectContaining({ id: orderId, is_draft_order: true }))
    })

    it("AC-18: no token → 401, another customer → 404 without a new session, owner → 200 with a session", async () => {
      const { collectionId } = await draftOrderCollection()

      const anonymous = await newSession(collectionId, PROMPTPAY, storeHeadersFor(pk)).catch((e) => e.response)
      expect(anonymous.status).toEqual(401)
      const stranger = await newSession(collectionId, PROMPTPAY, other).catch((e) => e.response)
      expect(stranger.status).toEqual(404)
      expect(PaymentIntents.create).not.toHaveBeenCalled()
      expect((await collectionState(collectionId)).sessionIds).toEqual([])

      const { status, data } = await newSession(collectionId, PROMPTPAY)
      expect(status).toEqual(200)
      expect(data.payment_collection.payment_sessions).toEqual([
        expect.objectContaining({ provider_id: PROMPTPAY, data: expect.objectContaining({ id: expect.any(String) }) }),
      ])

      const systemDefault = await draftOrderCollection()
      const manual = await newSession(systemDefault.collectionId, "pp_system_default")
      expect(manual.status).toEqual(200)
      expect(manual.data.payment_collection.payment_sessions).toHaveLength(1)
    })

    it("AC-18: another customer cannot make the guard ask the provider about the owner's paid session", async () => {
      const { collectionId } = await draftOrderCollection()
      const { data } = await newSession(collectionId, PROMPTPAY)
      const session = data.payment_collection.payment_sessions[0]
      piStatus = "succeeded"

      const stranger = await newSession(collectionId, PROMPTPAY, other).catch((e) => e.response)
      expect(stranger.status).toEqual(404)
      expect(retrieve).not.toHaveBeenCalled()
      expect((await collectionState(collectionId)).sessionIds).toEqual([session.id])
    })

    it("AC-18: guard together with the captured webhook leaves one live payment, keeps the session and locks on PC.id", async () => {
      const { collectionId } = await draftOrderCollection()
      const { data } = await newSession(collectionId, PROMPTPAY)
      const session = data.payment_collection.payment_sessions[0]
      piStatus = "succeeded"
      const lockExecute = jest.spyOn(getContainer().resolve(Modules.LOCKING), "execute")

      const [guard, webhook] = await Promise.allSettled([newSession(collectionId, PROMPTPAY), captured(session)])
      // spec 06 หมายเหตุ (รอบ 6): ฝั่งที่แพ้ race ได้ 409 หรือ non-2xx ใดก็ได้ — guard ชนะ = authorize สร้าง payment แล้ว 409;
      // guard แพ้ = authorizePaymentSession ของ Medusa ตอบ 400 "Payment with payment_session_id ... already exists"
      expect(guard.status).toEqual("rejected")
      expect((guard as PromiseRejectedResult).reason?.response?.status).toBeGreaterThanOrEqual(400)
      expect(["fulfilled", "rejected"]).toContain(webhook.status)
      expect(lockExecute).toHaveBeenCalledWith(collectionId, expect.any(Function), expect.anything())

      expect(await livePayments(session.id)).toHaveLength(1)
      const before = await collectionState(collectionId)
      expect(before.sessionIds).toEqual([session.id])
      expect(before.payments).toHaveLength(1)
      expect(before.payments[0].captures).toHaveLength(1)

      // Stripe retry ของ webhook เดิม → ไม่มี capture/payment เพิ่ม
      await captured(session).catch(() => undefined)
      expect(await livePayments(session.id)).toHaveLength(1)
      const after = await collectionState(collectionId)
      expect(after.sessionIds).toEqual([session.id])
      expect(after.payments).toEqual(before.payments)
    })
  },
})
