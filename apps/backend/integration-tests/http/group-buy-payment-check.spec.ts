import path from "path"
import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PaymentActions, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, processPaymentWorkflow } from "@medusajs/medusa/core-flows"
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

jest.setTimeout(300 * 1000)

// mock provider = SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบ group-buy-payment-closed.spec.ts) — mock เฉพาะ network
// PaymentIntents.retrieve = provider authorizePayment, cancel = deletePayment, capture = capturePayment, Refunds.create = refundPayment
const stripePkgDir = path.dirname(
  require.resolve("@medusajs/payment-stripe/package.json", {
    paths: [require.resolve("@medusajs/medusa/package.json")],
  })
)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require(require.resolve("stripe", { paths: [stripePkgDir] }))
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeBase = require(path.join(stripePkgDir, "dist/core/stripe-base.js")).default
const PaymentIntents = Stripe.resources.PaymentIntents.prototype

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const OPS_EMAIL = "gb20b-ops@example.com"
const SAVED_OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL
const CHECK_FAILED = "GROUP_BUY_PAYMENT_CHECK_FAILED"
const GAVE_UP = "GROUP_BUY_PAYMENT_CHECK_GAVE_UP"
const GAVE_UP_TEMPLATE = "group-buy-payment-check-gave-up"
const PAID_WITHOUT_ORDER = "GROUP_BUY_PAID_WITHOUT_ORDER"

type Member = { headers: { headers: Record<string, string> }; order_id: string; membership_id: string; group_id: string }
type Session = { id: string; pi: string; amount: number }

// GB-20b (spec 04 กฎข้อ 50, AC-68, ADR-024 ภาคผนวก 2026-11-21): ตรวจสถานะ PI ที่ provider ก่อน job หมดเวลาชำระยกเลิก
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productId: string
    let variantId: string
    let variantStocked: string
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
              title: "GB-20b product",
              handle: "gb20b-product",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Size", values: ["One", "Stocked"] }],
              variants: [
                {
                  title: "One",
                  options: { Size: "One" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
                {
                  title: "Stocked",
                  options: { Size: "Stocked" },
                  manage_inventory: true,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
              ],
              sales_channels: [{ id: (keys[0] as any).sales_channels[0].id }],
            },
          ],
        },
      })
      productId = result[0].id
      variantId = result[0].variants.find((v) => v.title === "One")!.id
      variantStocked = result[0].variants.find((v) => v.title === "Stocked")!.id
    })

    afterAll(() => {
      if (SAVED_OPS_ALERT_EMAIL === undefined) {
        delete process.env.OPS_ALERT_EMAIL
      } else {
        process.env.OPS_ALERT_EMAIL = SAVED_OPS_ALERT_EMAIL
      }
    })

    // สถานะ PI ที่ provider ต่อ PI id: string = PaymentIntent.status, Error = provider/network ล่ม
    let intents: Map<string, { status: string; amount: number } | Error>
    let retrieveIntent: jest.SpyInstance
    let cancelIntent: jest.SpyInstance
    let captureIntent: jest.SpyInstance
    let createRefund: jest.SpyInstance
    beforeEach(() => {
      intents = new Map()
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      jest
        .spyOn(Stripe.resources.Customers.prototype, "create")
        .mockImplementation(async () => ({ id: `cus_gb20b_${++seq}`, object: "customer" }))
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => {
        const id = `pi_gb20b_${++seq}`
        intents.set(id, { status: "requires_payment_method", amount: params.amount })
        return { id, object: "payment_intent", amount: params.amount, currency: "thb", status: "requires_payment_method", metadata: params.metadata }
      })
      const intent = (id: string, status: string, amount = 0) => ({
        id,
        object: "payment_intent",
        currency: "thb",
        amount,
        amount_received: status === "succeeded" ? amount : 0,
        status,
      })
      retrieveIntent = jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => {
        const state = intents.get(id)
        if (state instanceof Error) {
          throw state
        }
        return intent(id, state?.status ?? "requires_payment_method", state?.amount)
      })
      cancelIntent = jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => intent(id, "canceled"))
      captureIntent = jest.spyOn(PaymentIntents, "capture").mockImplementation(async (id: string) => intent(id, "succeeded"))
      createRefund = jest
        .spyOn(Stripe.resources.Refunds.prototype, "create")
        .mockImplementation(async () => ({ id: "re_gb20b", object: "refund", status: "succeeded" }))
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const groupBuy = (): GroupBuyModuleService => getContainer().resolve(GROUP_BUY_MODULE)
    const eventBus = () => getContainer().resolve(Modules.EVENT_BUS)
    const logger = () => getContainer().resolve(ContainerRegistrationKeys.LOGGER)
    const paymentModule = () => getContainer().resolve(Modules.PAYMENT)

    // กลุ่ม pool ที่ถึงเป้า (target = จำนวนสมาชิก) ผ่าน store route → GB-4 สร้าง payment collection ของ draft order
    async function awaitingPaymentMembers(count: number, variant = variantId): Promise<Member[]> {
      const { result: campaign } = await createGroupBuyCampaignWorkflow(getContainer()).run({
        input: {
          name: "GB-20b payment check",
          target_type: "orders",
          target_value: count,
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
      const members: Member[] = []
      for (let i = 0; i < count; i++) {
        const { token } = await registerCustomer(api, pk, `gb20b+${Date.now()}-${i}@example.com`, "gb20b-password")
        const headers = storeHeadersFor(pk, token)
        const { data: cart } = await api.post(
          "/store/carts",
          { region_id: regionId, items: [{ variant_id: variant, quantity: 1 }] },
          headers
        )
        const succeeded =
          i === count - 1 ? TestEventUtils.waitSubscribersExecution(GROUP_BUY_GROUP_SUCCEEDED, eventBus()) : null
        const { data: res } = await api.post(
          `/store/group-buy/groups/${group.join_token}/join`,
          { cart_id: cart.cart.id },
          headers
        )
        await succeeded
        members.push({ headers, order_id: res.membership.order_id, membership_id: res.membership.id, group_id: group.id })
      }
      for (const m of members) {
        expect((await membershipOf(m)).status).toEqual("awaiting_payment")
      }
      return members
    }

    const membershipOf = async (m: Member) => (await groupBuy().listGroupBuyMemberships({ id: m.membership_id }))[0]
    const pastDeadline = (m: Member, minutes: number) =>
      groupBuy().updateGroupBuyGroups({ id: m.group_id, pay_deadline_at: new Date(Date.now() - minutes * MINUTE) })

    async function orderOf(orderId: string) {
      const { data } = await query().graph({
        entity: "order",
        fields: [
          "status",
          "is_draft_order",
          "transactions.reference",
          "transactions.reference_id",
          "payment_collections.id",
          "payment_collections.status",
          "payment_collections.payment_sessions.id",
          "payment_collections.payments.id",
          "payment_collections.payments.captured_at",
          "payment_collections.payments.captures.id",
          "payment_collections.payments.refunds.id",
        ],
        filters: { id: orderId },
      })
      const order = data[0] as any
      const collection = order.payment_collections[0]
      const payments = (collection.payments ?? []).filter(Boolean)
      return {
        status: order.status as string,
        isDraft: !!order.is_draft_order,
        collectionId: collection.id as string,
        collectionStatus: collection.status as string,
        sessionIds: (collection.payment_sessions ?? []).filter(Boolean).map((s: { id: string }) => s.id),
        payments,
        captures: payments.flatMap((p: any) => (p.captures ?? []).filter(Boolean)),
        refunds: payments.flatMap((p: any) => (p.refunds ?? []).filter(Boolean)),
        captureTransactions: (order.transactions ?? []).filter((t: any) => t?.reference === "capture"),
      }
    }

    // สมาชิกสร้าง session ผ่าน store route ของ Medusa (ก่อน deadline) — ได้ PI ที่ provider
    async function openSession(member: Member): Promise<Session> {
      const { collectionId } = await orderOf(member.order_id)
      const res = await api
        .post(`/store/payment-collections/${collectionId}/payment-sessions`, { provider_id: PROMPTPAY }, member.headers)
        .catch((e) => {
          throw new Error(`${e?.response?.status} ${JSON.stringify(e?.response?.data)}`)
        })
      const session = res.data.payment_collection.payment_sessions[0]
      return { id: session.id, pi: session.data.id, amount: session.amount }
    }

    const setIntent = (s: Session, state: string | Error) =>
      intents.set(s.pi, state instanceof Error ? state : { status: state, amount: Math.round(s.amount * 100) })

    // รัน job แล้วรอ subscriber ของ event ที่คาดว่าจะเกิด (payment.captured → GB-5 แปลง order)
    async function runJob(events: string[] = []) {
      const settled = Promise.allSettled(events.map((e) => TestEventUtils.waitSubscribersExecution(e, eventBus())))
      await groupBuyDeadlineJob(getContainer())
      await settled
    }

    const loggedLines = (spy: jest.SpyInstance, prefix: string) =>
      spy.mock.calls.filter(([message]) => String(message).startsWith(prefix))
    const capturedEmits = (spy: jest.SpyInstance) =>
      spy.mock.calls
        .flatMap(([events]) => (Array.isArray(events) ? events : [events]))
        .filter((e: { name?: string }) => e?.name === "payment.captured").length
    const gaveUpEmails = () =>
      getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: OPS_EMAIL, template: GAVE_UP_TEMPLATE })

    it("(a) PI succeeded at the provider but no webhook yet → job captures, membership paid, order placed; late webhook is a no-op", async () => {
      const [member] = await awaitingPaymentMembers(1)
      const session = await openSession(member)
      setIntent(session, "succeeded")
      await pastDeadline(member, 1)
      const error = jest.spyOn(logger(), "error")

      await runJob(["payment.captured", "order.placed"])

      expect(cancelIntent).not.toHaveBeenCalled()
      let order = await orderOf(member.order_id)
      expect(order.sessionIds).toEqual([session.id])
      expect(order.payments).toHaveLength(1)
      expect(order.payments[0].captured_at).toBeTruthy()
      expect(order.captures).toHaveLength(1)
      expect((await membershipOf(member)).status).toEqual("paid")
      expect(order.isDraft).toBe(false)
      expect(order.refunds).toHaveLength(0)
      expect(loggedLines(error, PAID_WITHOUT_ORDER)).toHaveLength(0)

      // webhook payment_intent.succeeded มาช้า → processPaymentWorkflow ของ session เดิม
      const settled = TestEventUtils.waitSubscribersExecution("payment.captured", eventBus())
      await processPaymentWorkflow(getContainer()).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount } },
      })
      await settled

      order = await orderOf(member.order_id)
      expect(order.payments).toHaveLength(1)
      expect(order.captures).toHaveLength(1)
      expect(order.captureTransactions).toHaveLength(1)
      expect(order.captureTransactions[0].reference_id).toEqual(order.captures[0].id)
      expect((await membershipOf(member)).status).toEqual("paid")
      expect(captureIntent).not.toHaveBeenCalled()
      expect(createRefund).not.toHaveBeenCalled()
      expect(order.refunds).toHaveLength(0)
      expect(loggedLines(error, PAID_WITHOUT_ORDER)).toHaveLength(0)
    })

    it("(a2) payment found but convert fails → re-picked within 15 minutes without the provider; not re-captured past 15 minutes", async () => {
      const inventory = getContainer().resolve(Modules.INVENTORY)
      const { data: variants } = await query().graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantStocked },
      })
      const { data: locations } = await query().graph({ entity: "stock_location", fields: ["id"] })
      const levels = (quantity: number) =>
        locations.map((l) => ({
          inventory_item_id: (variants[0] as any).inventory_items[0].inventory_item_id,
          location_id: l.id,
          stocked_quantity: quantity,
        }))
      await inventory.createInventoryLevels(levels(1))
      const [member] = await awaitingPaymentMembers(1, variantStocked)
      const session = await openSession(member)
      setIntent(session, "succeeded")
      await pastDeadline(member, 1)
      // สต็อกหมดระหว่างรอชำระ (draft order ไม่จอง inventory — กฎข้อ 6) → convertDraftOrderWorkflow ล้ม
      await inventory.updateInventoryLevels(levels(0))

      await runJob(["payment.captured"])
      expect((await membershipOf(member)).status).toEqual("awaiting_payment")
      expect((await orderOf(member.order_id)).isDraft).toBe(true)
      expect(retrieveIntent).toHaveBeenCalledTimes(1)

      // เลย 15 นาที: payment มีอยู่แล้ว → ไม่ capture ซ้ำ ไม่ยกเลิก ไม่ give-up (พึ่ง webhook / alert convert_failed)
      await pastDeadline(member, 16)
      const emit = jest.spyOn(eventBus(), "emit")
      const error = jest.spyOn(logger(), "error")
      await runJob()
      expect(capturedEmits(emit)).toEqual(0)
      expect((await membershipOf(member)).status).toEqual("awaiting_payment")
      expect(loggedLines(error, GAVE_UP)).toHaveLength(0)
      expect(cancelIntent).not.toHaveBeenCalled()
      emit.mockRestore()

      // ยังไม่ถึง 15 นาที + คืนสต็อก → หยิบซ้ำ capture ใหม่ (idempotent) ไม่เรียก provider อีก
      await pastDeadline(member, 2)
      await inventory.updateInventoryLevels(levels(1))
      await runJob(["payment.captured", "order.placed"])
      expect(retrieveIntent).toHaveBeenCalledTimes(1)
      const order = await orderOf(member.order_id)
      expect(order.payments).toHaveLength(1)
      expect(order.captures).toHaveLength(1)
      expect((await membershipOf(member)).status).toEqual("paid")
      expect(order.isDraft).toBe(false)
      expect(captureIntent).not.toHaveBeenCalled()
    })

    it("(b) PI requires_action (NOT_ALLOWED = unpaid) → session deleted, membership cancelled; no session → provider not called", async () => {
      const [member] = await awaitingPaymentMembers(1)
      const session = await openSession(member)
      setIntent(session, "requires_action")
      await pastDeadline(member, 1)

      await runJob()

      expect(cancelIntent).toHaveBeenCalledTimes(1)
      expect((await membershipOf(member)).status).toEqual("cancelled")
      const order = await orderOf(member.order_id)
      expect(order.status).toEqual("canceled")
      expect(order.collectionStatus).toEqual("canceled")
      expect(order.sessionIds).toEqual([])
      expect(order.payments).toHaveLength(0)
      expect(await paymentModule().listPaymentSessions({ id: session.id })).toHaveLength(0)

      const [noSession] = await awaitingPaymentMembers(1)
      await pastDeadline(noSession, 1)
      retrieveIntent.mockClear()
      await runJob()
      expect(retrieveIntent).not.toHaveBeenCalled()
      expect((await membershipOf(noSession)).status).toEqual("cancelled")
    })

    it("(c) provider down / pending_authorization / PI processing → retry: not cancelled, session kept, one warn per run", async () => {
      const [member] = await awaitingPaymentMembers(1)
      const session = await openSession(member)
      await pastDeadline(member, 1)
      const expectRetry = async () => {
        const warn = jest.spyOn(logger(), "warn")
        await runJob()
        expect((await membershipOf(member)).status).toEqual("awaiting_payment")
        expect((await orderOf(member.order_id)).sessionIds).toEqual([session.id])
        expect(cancelIntent).not.toHaveBeenCalled()
        const lines = loggedLines(warn, CHECK_FAILED)
        expect(lines).toHaveLength(1)
        expect(String(lines[0][0])).toContain(member.membership_id)
        expect(String(lines[0][0])).toContain(session.id)
        warn.mockRestore()
      }

      setIntent(session, new Error("provider down"))
      await expectRetry()

      // PI ที่ provider = requires_action (ถ้า mock ไม่ทำงานจะได้ unpaid แล้ว test ล้ม) แต่ provider ตอบ pending_authorization
      setIntent(session, "requires_action")
      const pending = jest
        .spyOn(StripeBase.prototype, "authorizePayment")
        .mockResolvedValue({ status: "pending_authorization", data: { id: session.pi, status: "requires_capture_mock" } })
      await expectRetry()
      expect(pending).toHaveBeenCalledTimes(1)
      pending.mockRestore()

      // Stripe processing เมื่อไม่ตั้ง asyncPaymentMethodTypes = pending → Payment module throw NOT_ALLOWED
      setIntent(session, "processing")
      await expectRetry()
      // nit 2 (review #440): Medusa บันทึก data ก่อน throw — ไม่ถูก rollback เพราะ step ไม่ส่ง transaction context
      const stored = await paymentModule().retrievePaymentSession(session.id, { select: ["status", "data"] })
      expect((stored.data as { status?: string }).status).toEqual("processing")
    })

    it("(c) still unverifiable 16 minutes past the deadline → give up: cancel + error log + one ops email; another member paid in the same run", async () => {
      const [stuck, paidLate] = await awaitingPaymentMembers(2)
      const stuckSession = await openSession(stuck)
      const paidSession = await openSession(paidLate)
      setIntent(stuckSession, new Error("provider down"))
      // nit 1 (review #440): การจ่ายที่ job เพิ่งเจอครั้งแรกหลัง 15 นาที (worker ดับนาน) ยังนับเป็น paid
      setIntent(paidSession, "succeeded")
      await pastDeadline(stuck, 16)
      const error = jest.spyOn(logger(), "error")

      await runJob(["payment.captured", "order.placed"])

      expect((await membershipOf(stuck)).status).toEqual("cancelled")
      expect(cancelIntent).toHaveBeenCalledTimes(1)
      const lines = loggedLines(error, GAVE_UP)
      expect(lines).toHaveLength(1)
      expect(String(lines[0][0])).toContain(stuck.membership_id)
      const emails = await gaveUpEmails()
      expect(emails).toHaveLength(1)
      expect(emails[0].data).toEqual(expect.objectContaining({ membership_id: stuck.membership_id, order_id: stuck.order_id }))

      expect((await membershipOf(paidLate)).status).toEqual("paid")
      expect((await orderOf(paidLate.order_id)).isDraft).toBe(false)

      await runJob()
      expect(await gaveUpEmails()).toHaveLength(1)
    })
  },
})
