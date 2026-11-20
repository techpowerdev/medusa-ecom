import path from "path"
import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  Modules,
  PaymentWebhookEvents,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { createGroupBuyCampaignWorkflow, type CreateGroupBuyCampaignInput } from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { GROUP_BUY_GROUP_SUCCEEDED } from "../../src/workflows/group-buy/join-group"
import groupBuyDeadlineJob from "../../src/jobs/group-buy-deadline"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"
import { PAYMENT_WEBHOOK_SESSION_NOT_FOUND } from "../../src/subscribers/payment-webhook-orphan"

jest.setTimeout(240 * 1000)

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบเดียวกับ payment-session-draft-order.spec.ts) — mock เฉพาะ network
// PaymentIntents.create = provider initiatePayment, PaymentIntents.cancel = provider deletePayment
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

const HOUR = 60 * 60 * 1000
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const OPS_EMAIL = "gb20-ops@example.com"
const SAVED_OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL
const SESSION_CANCEL_FAILED = "GROUP_BUY_SESSION_CANCEL_FAILED"

type Member = { headers: { headers: Record<string, string> }; order_id: string; membership_id: string; group_id: string }

// GB-20 (spec 04 กฎข้อ 42–43, AC-62, ADR-024 a/b): GB-BUG-1 — สร้าง session ได้หลังสิทธิ์ถูกยกเลิก และ PI ค้างหลังหมดเวลาชำระ
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productId: string
    let variantId: string
    let seq = 0

    beforeAll(async () => {
      process.env.OPS_ALERT_EMAIL = OPS_EMAIL
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      regionId = (await query.graph({ entity: "region", fields: ["id"] })).data[0].id
      const { data: keys } = await query.graph({
        entity: "api_key",
        fields: ["sales_channels.id"],
        filters: { token: pk },
      })
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "GB-20 product",
              handle: "gb20-product",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  options: { Size: "One" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
              ],
              sales_channels: [{ id: (keys[0] as any).sales_channels[0].id }],
            },
          ],
        },
      })
      productId = result[0].id
      variantId = result[0].variants[0].id
    })

    afterAll(() => {
      if (SAVED_OPS_ALERT_EMAIL === undefined) {
        delete process.env.OPS_ALERT_EMAIL
      } else {
        process.env.OPS_ALERT_EMAIL = SAVED_OPS_ALERT_EMAIL
      }
    })

    let cancelIntent: jest.SpyInstance
    beforeEach(() => {
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      jest
        .spyOn(Stripe.resources.Customers.prototype, "create")
        .mockImplementation(async () => ({ id: "cus_gb20_test", object: "customer" }))
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => ({
        id: `pi_gb20_${++seq}`,
        object: "payment_intent",
        amount: params.amount,
        currency: "thb",
        status: "requires_payment_method",
        metadata: params.metadata,
      }))
      const intent = (id: string, status: string) => ({ id, object: "payment_intent", currency: "thb", status })
      jest
        .spyOn(PaymentIntents, "retrieve")
        .mockImplementation(async (id: string) => intent(id, "requires_payment_method"))
      cancelIntent = jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => intent(id, "canceled"))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const groupBuy = (): GroupBuyModuleService => getContainer().resolve(GROUP_BUY_MODULE)
    const eventBus = () => getContainer().resolve(Modules.EVENT_BUS)
    const logger = () => getContainer().resolve(ContainerRegistrationKeys.LOGGER)

    // กลุ่ม pool 1 คนที่ถึงเป้าผ่าน store route → GB-4 สร้าง payment collection ของ draft order
    async function awaitingPaymentMember(): Promise<Member> {
      const { result: campaign } = await createGroupBuyCampaignWorkflow(getContainer()).run({
        input: {
          name: "GB-20 payment closed",
          target_type: "orders",
          target_value: 1,
          group_mode: "pool",
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 30,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
          },
          rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
        } as CreateGroupBuyCampaignInput,
      })
      await setGroupBuyCampaignStatusWorkflow(getContainer()).run({ input: { id: campaign.id, status: "active" } })
      const { result: group } = await createGroupWorkflow(getContainer()).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      })
      const { token } = await registerCustomer(api, pk, `gb20+${Date.now()}@example.com`, "gb20-password")
      const headers = storeHeadersFor(pk, token)
      const { data: cart } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }] },
        headers
      )
      const succeeded = TestEventUtils.waitSubscribersExecution(GROUP_BUY_GROUP_SUCCEEDED, eventBus())
      const { data: res } = await api.post(
        `/store/group-buy/groups/${group.join_token}/join`,
        { cart_id: cart.cart.id },
        headers
      )
      await succeeded
      const member = { headers, order_id: res.membership.order_id, membership_id: res.membership.id, group_id: group.id }
      expect((await membershipOf(member)).status).toEqual("awaiting_payment")
      return member
    }

    const membershipOf = async (m: Member) => (await groupBuy().listGroupBuyMemberships({ id: m.membership_id }))[0]
    const pastDeadline = (m: Member) =>
      groupBuy().updateGroupBuyGroups({ id: m.group_id, pay_deadline_at: new Date(Date.now() - 1000) })

    async function collectionOf(orderId: string) {
      const { data } = await query().graph({
        entity: "order",
        fields: ["status", "payment_collections.id", "payment_collections.status", "payment_collections.payment_sessions.id"],
        filters: { id: orderId },
      })
      const order = data[0] as any
      const collection = order.payment_collections[0]
      return {
        orderStatus: order.status as string,
        id: collection.id as string,
        status: collection.status as string,
        sessionIds: (collection.payment_sessions ?? []).filter(Boolean).map((s: { id: string }) => s.id),
      }
    }

    // ห่อ error ของ axios ไม่ให้ object circular หลุดออกจาก test (CLAUDE.md)
    const newSession = (collectionId: string, headers: { headers: Record<string, string> }) =>
      api.post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: PROMPTPAY }, headers).then(
        (r) => ({ status: r.status, data: r.data }),
        (e) => ({ status: e?.response?.status, data: e?.response?.data })
      )

    async function expectClosed(member: Member) {
      const { id } = await collectionOf(member.order_id)
      const res = await newSession(id, member.headers)
      expect(res.status).toEqual(400)
      expect(res.data).toEqual(expect.objectContaining({ type: "not_allowed", code: "GB_PAYMENT_CLOSED" }))
      expect(PaymentIntents.create).not.toHaveBeenCalled()
      expect((await collectionOf(member.order_id)).sessionIds).toEqual([])
    }

    const loggedLines = (spy: jest.SpyInstance, prefix: string) =>
      spy.mock.calls.filter(([message]) => String(message).startsWith(prefix))

    it("(a) awaiting_payment past pay_deadline_at (job not run yet) → 400 GB_PAYMENT_CLOSED, provider not called", async () => {
      const member = await awaitingPaymentMember()
      await pastDeadline(member)
      await expectClosed(member)
    })

    it("(b) membership cancelled → 400 GB_PAYMENT_CLOSED, provider not called", async () => {
      const member = await awaitingPaymentMember()
      await groupBuy().updateGroupBuyMemberships({ id: member.membership_id, status: "cancelled" })
      await expectClosed(member)
    })

    it("(c) awaiting_payment before the deadline → 200 with a Stripe session (regression spec 06 AC-18)", async () => {
      const member = await awaitingPaymentMember()
      const { id } = await collectionOf(member.order_id)
      const res = await newSession(id, member.headers)
      expect(res.status).toEqual(200)
      expect(res.data.payment_collection.payment_sessions).toEqual([
        expect.objectContaining({ provider_id: PROMPTPAY, data: expect.objectContaining({ id: expect.any(String) }) }),
      ])
      expect(PaymentIntents.create).toHaveBeenCalledTimes(1)
    })

    it("(d) collection of a normal cart → unchanged behaviour (200)", async () => {
      const { token } = await registerCustomer(api, pk, `gb20-cart+${Date.now()}@example.com`, "gb20-password")
      const headers = storeHeadersFor(pk, token)
      const { data: cart } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }] },
        headers
      )
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cart.cart.id }, headers)
      const res = await newSession(pc.payment_collection.id, headers)
      expect(res.status).toEqual(200)
      expect(res.data.payment_collection.payment_sessions).toHaveLength(1)
    })

    async function expiredWithPendingSession() {
      const member = await awaitingPaymentMember()
      const before = await collectionOf(member.order_id)
      const res = await newSession(before.id, member.headers)
      expect(res.status).toEqual(200)
      const sessionId = res.data.payment_collection.payment_sessions[0].id as string
      await pastDeadline(member)
      return { member, sessionId }
    }

    it("(e) payment-deadline job deletes the pending session through the provider; membership cancelled, collection canceled", async () => {
      const { member, sessionId } = await expiredWithPendingSession()
      const warn = jest.spyOn(logger(), "warn")

      await groupBuyDeadlineJob(getContainer())

      expect(cancelIntent).toHaveBeenCalledTimes(1)
      expect((await membershipOf(member)).status).toEqual("cancelled")
      const after = await collectionOf(member.order_id)
      expect(after.orderStatus).toEqual("canceled")
      expect(after.status).toEqual("canceled")
      expect(after.sessionIds).toEqual([])
      expect(await getContainer().resolve(Modules.PAYMENT).listPaymentSessions({ id: sessionId })).toHaveLength(0)
      expect(loggedLines(warn, SESSION_CANCEL_FAILED)).toHaveLength(0)

      // job รอบถัดไป: membership ยกเลิกแล้ว ไม่เรียก provider ซ้ำ
      await groupBuyDeadlineJob(getContainer())
      expect(cancelIntent).toHaveBeenCalledTimes(1)
    })

    it("(f) provider deletePayment throws → membership/order still cancelled, one warn GROUP_BUY_SESSION_CANCEL_FAILED", async () => {
      const { member } = await expiredWithPendingSession()
      cancelIntent.mockImplementation(async () => {
        throw new Error("stripe down")
      })
      const warn = jest.spyOn(logger(), "warn")

      await groupBuyDeadlineJob(getContainer())

      expect(cancelIntent).toHaveBeenCalled()
      expect((await membershipOf(member)).status).toEqual("cancelled")
      const after = await collectionOf(member.order_id)
      expect(after.orderStatus).toEqual("canceled")
      expect(after.status).toEqual("canceled")
      const lines = loggedLines(warn, SESSION_CANCEL_FAILED)
      expect(lines).toHaveLength(1)
      expect(String(lines[0][0])).toContain(member.order_id)
    })

    it("(g) accepted race: webhook payment_intent.succeeded for the deleted session → PAYMENT_WEBHOOK_SESSION_NOT_FOUND + one ops email, no payment/refund", async () => {
      const { sessionId } = await expiredWithPendingSession()
      await groupBuyDeadlineJob(getContainer())
      const error = jest.spyOn(logger(), "error")

      const handled = TestEventUtils.waitSubscribersExecution(PaymentWebhookEvents.WebhookReceived, eventBus())
      await eventBus().emit({ name: PaymentWebhookEvents.WebhookReceived, data: webhookEvent(sessionId) })
      await handled.catch(() => undefined)

      expect(loggedLines(error, PAYMENT_WEBHOOK_SESSION_NOT_FOUND)).toHaveLength(1)
      const emails = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ to: OPS_EMAIL, template: "payment-webhook-orphan" })
      expect(emails).toHaveLength(1)
      const payment = getContainer().resolve(Modules.PAYMENT)
      expect(await payment.listPayments({ payment_session_id: sessionId })).toHaveLength(0)
      expect(await payment.listRefunds({})).toHaveLength(0)
    })
  },
})

// event data แบบเดียวกับที่ route `/hooks/payment/:provider` ของ Medusa emit (แบบ payment-webhook-orphan.spec.ts)
// ADR-023: endpoint เดียว → provider ใน event = stripe_stripe
function webhookEvent(sessionId: string) {
  const body = {
    id: `evt_gb20_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_gb20_race",
        object: "payment_intent",
        amount: 70000,
        amount_received: 70000,
        amount_capturable: 0,
        currency: "thb",
        status: "succeeded",
        metadata: { session_id: sessionId },
      },
    },
  }
  const payload = JSON.stringify(body)
  const signature = new Stripe("sk_test_signing_only").webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  return {
    provider: "stripe_stripe",
    payload: {
      data: body,
      rawData: Buffer.from(payload),
      headers: { "content-type": "application/json", "stripe-signature": signature },
    },
  }
}
