import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  completeCartWorkflow,
  beginReceiveReturnWorkflow,
  beginReturnOrderWorkflow,
  confirmReturnReceiveWorkflow,
  confirmReturnRequestWorkflow,
  createCartWorkflow,
  createOrderFulfillmentWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  createProductsWorkflow,
  receiveItemReturnRequestWorkflow,
  refundPaymentWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import affiliateReversalHandler from "../../src/subscribers/affiliate-reversal"
import affiliateMaturityJob, { config as maturityJobConfig } from "../../src/jobs/affiliate-maturity"
import { approveMaturedCommissionEntriesWorkflow } from "../../src/workflows/affiliate/approve-matured-entries"
import { createAffiliatePayoutWorkflow } from "../../src/workflows/affiliate/affiliate-payout"

process.env.AFFILIATE_TOKEN_SECRET = "af4-integration-secret"

jest.setTimeout(300 * 1000)

const DAY = 24 * 60 * 60 * 1000

// AF-4 (spec 05): reversal เมื่อ refund/cancel/return (AC-5) + maturity job (AC-6)
// ราคา THB รวม VAT 7% (seed) → 1,070 = ฿1,000 ไม่รวมภาษี
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let container: MedusaContainer
    let affiliates: AffiliateModuleService
    let regionId: string
    let shippingOptionId: string
    let locationId: string
    let variant1000: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "af4-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "af4-test-password"
      await seedThailand({ container, args: [] })
      affiliates = container.resolve(AFFILIATE_MODULE)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "shipping_profile_id"],
        filters: { name: "Standard" },
      })
      shippingOptionId = options[0].id
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })

      const eventBus = container.resolve(Modules.EVENT_BUS)
      const indexed = Promise.all(
        ["product.created", "product-variant.created"].map((name) =>
          TestEventUtils.waitSubscribersExecution(name, eventBus)
        )
      )
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "af4-1000",
              handle: "af4-1000",
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: options[0].shipping_profile_id,
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  manage_inventory: false,
                  options: { Size: "One" },
                  prices: [{ currency_code: "thb", amount: 1070 }],
                },
              ],
              sales_channels: [{ id: channels[0].id }],
            },
          ],
        },
      })
      await indexed
      variant1000 = result[0].variants[0].id
    })

    const andWait = async <T>(eventName: string, fn: () => Promise<T>) => {
      const done = TestEventUtils.waitSubscribersExecution(eventName, container.resolve(Modules.EVENT_BUS))
      const result = await fn()
      await done
      return result
    }

    // order ฿1,000 × quantity ที่ attribute ให้ Ann ในโปรแกรม 10% → entry pending ฿100 ต่อชิ้น
    const placeAttributedOrder = async (
      opts: { quantity?: number; hold_days?: number; affiliate_id?: string } = {}
    ) => {
      seq += 1
      const ann = opts.affiliate_id
        ? { id: opts.affiliate_id }
        : await affiliates.createAffiliates({
            email: `ann-${seq}@example.com`,
            name: "Ann",
            code: `ann-${seq}`,
            status: "active",
          })
      await affiliates.createAffiliatePrograms({
        name: `P${seq}`,
        status: "published",
        starts_at: new Date(Date.now() - DAY),
        ends_at: new Date(Date.now() + DAY),
        commission_type: "percentage",
        commission_value: 10,
        scope: { all: true },
        attribution_window_days: 7,
        hold_days: opts.hold_days ?? 14,
      })
      const email = `af4-buyer-${seq}@example.com`
      const customer = await container.resolve(Modules.CUSTOMER).createCustomers({ email, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          email,
          metadata: { affiliate_token: await affiliates.signClickToken(ann.id, new Date(Date.now() - 60 * 1000)) },
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: variant1000, quantity: opts.quantity ?? 1 }],
        },
      })
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: [{ id: shippingOptionId }] },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: "pp_system_default" },
      })
      const { result: order } = await andWait("order.placed", () =>
        completeCartWorkflow(container).run({ input: { id: cart.id } })
      )
      const [entry] = await entriesOf(order.id)
      expect(entry).toEqual(expect.objectContaining({ status: "pending", amount: 100 * (opts.quantity ?? 1) }))
      return { orderId: order.id, entry }
    }

    const entriesOf = (orderId: string) =>
      affiliates.listAffiliateCommissionEntries({ order_id: orderId }, { order: { created_at: "ASC" } })

    const paymentOf = async (orderId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["payment_collections.payments.id"],
        filters: { id: orderId },
      })
      return data[0].payment_collections![0]!.payments![0]!.id
    }

    const netOf = async (orderId: string) =>
      (await entriesOf(orderId)).reduce((total, e) => total + Number(e.amount), 0)

    describe("AC-5 reversal", () => {
      it("a full refund appends a reversed −฿100 entry with matures_at null; net is 0 and the entry is untouched", async () => {
        const { orderId, entry } = await placeAttributedOrder()
        const paymentId = await paymentOf(orderId)
        await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })

        await andWait("payment.refunded", () =>
          refundPaymentWorkflow(container).run({ input: { payment_id: paymentId } })
        )

        const entries = await entriesOf(orderId)
        expect(entries).toEqual([
          expect.objectContaining({ id: entry.id, amount: 100, status: "pending" }),
          expect.objectContaining({
            affiliate_id: entry.affiliate_id,
            program_id: entry.program_id,
            line_item_id: entry.line_item_id,
            amount: -100,
            currency: "thb",
            status: "reversed",
            reason: "refunded",
            matures_at: null,
          }),
        ])
        expect(await netOf(orderId)).toBe(0)

        // event ส่งซ้ำ → ไม่ reverse ซ้ำ
        await affiliateReversalHandler({
          event: { name: "payment.refunded", data: { id: paymentId } },
          container,
        } as Parameters<typeof affiliateReversalHandler>[0])
        expect(await entriesOf(orderId)).toHaveLength(2)
      })

      it("a partial refund without a return does not reverse anything", async () => {
        const { orderId } = await placeAttributedOrder()
        const paymentId = await paymentOf(orderId)
        await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })

        await andWait("payment.refunded", () =>
          refundPaymentWorkflow(container).run({ input: { payment_id: paymentId, amount: 100 } })
        )

        expect(await entriesOf(orderId)).toHaveLength(1)
      })

      it("order.canceled reverses the whole commission", async () => {
        const { orderId } = await placeAttributedOrder()

        await andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

        expect((await entriesOf(orderId)).map((e) => [e.status, e.amount, e.reason])).toEqual([
          ["pending", 100, null],
          ["reversed", -100, "canceled"],
        ])
      })

      it("a received return of 1 of 2 units reverses half of the line (Q3)", async () => {
        const { orderId, entry } = await placeAttributedOrder({ quantity: 2 })
        await createOrderFulfillmentWorkflow(container).run({
          input: { order_id: orderId, items: [{ id: entry.line_item_id!, quantity: 2 }] },
        })

        // flow คืนของของ admin: ขอคืน 1 ชิ้น → ยืนยัน → รับของ → ยืนยันรับ (emit order.return_received)
        const items = [{ id: entry.line_item_id!, quantity: 1 }]
        const { result: begun } = await beginReturnOrderWorkflow(container).run({
          input: { order_id: orderId, location_id: locationId },
        })
        const return_id = begun.return_id!
        await requestItemReturnWorkflow(container).run({ input: { return_id, items } })
        await confirmReturnRequestWorkflow(container).run({ input: { return_id } })
        await beginReceiveReturnWorkflow(container).run({ input: { return_id } })
        await receiveItemReturnRequestWorkflow(container).run({ input: { return_id, items } })
        await andWait("order.return_received", () =>
          confirmReturnReceiveWorkflow(container).run({ input: { return_id } })
        )

        expect((await entriesOf(orderId)).map((e) => [e.status, e.amount, e.reason])).toEqual([
          ["pending", 200, null],
          ["reversed", -100, "returned"],
        ])
      })
    })

    describe("AC-6 maturity", () => {
      const approveAt = (now: Date) =>
        approveMaturedCommissionEntriesWorkflow(container).run({ input: { now: now.toISOString() } })

      it("hold_days=14: the entry stays pending before 14 days and becomes approved only after", async () => {
        const { orderId, entry } = await placeAttributedOrder({ hold_days: 14 })
        const matures = entry.matures_at!.getTime()

        await approveAt(new Date(matures - 60 * 1000))
        expect((await entriesOf(orderId))[0].status).toBe("pending")

        await approveAt(new Date(matures))
        const [approved] = await entriesOf(orderId)
        expect(approved).toEqual(expect.objectContaining({ status: "approved", amount: 100 }))
        expect(approved.matures_at).toEqual(entry.matures_at)
      })

      it("a matured entry whose line is fully reversed is not approved (Q8)", async () => {
        const { orderId } = await placeAttributedOrder({ hold_days: 14 })
        await andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

        await approveAt(new Date(Date.now() + 15 * DAY))

        expect((await entriesOf(orderId)).map((e) => e.status)).toEqual(["pending", "reversed"])
      })

      it("the daily job approves entries that matured by now", async () => {
        const { orderId } = await placeAttributedOrder({ hold_days: 0 })

        await affiliateMaturityJob(container)

        expect((await entriesOf(orderId))[0].status).toBe("approved")
        expect(maturityJobConfig).toEqual(expect.objectContaining({ name: "affiliate-maturity", schedule: expect.any(String) }))
      })
    })

    // owner 2026-10-26: payout เลือก entry `reversed` เฉพาะเมื่อ entry ต้นทางของ line เดียวกันเป็น approved/paid แล้ว
    describe("payout with reversals", () => {
      const payableOf = async (affiliate_id: string) =>
        (await affiliates.listPayableCommissionEntries({ affiliate_id, period_to: new Date(Date.now() + 30 * DAY) }))
          .map((e) => [e.status, Number(e.amount)])
          .sort()

      it("a full reversal before the hold ends does not reduce the payout", async () => {
        const { entry: kept } = await placeAttributedOrder({ hold_days: 14 })
        const { orderId: canceledOrder } = await placeAttributedOrder({ hold_days: 14, affiliate_id: kept.affiliate_id })
        await andWait("order.canceled", () =>
          cancelOrderWorkflow(container).run({ input: { order_id: canceledOrder } })
        )
        await approveMaturedCommissionEntriesWorkflow(container).run({
          input: { now: new Date(Date.now() + 15 * DAY).toISOString() },
        })

        expect(await payableOf(kept.affiliate_id)).toEqual([["approved", 100]])
        const { result: payout } = await createAffiliatePayoutWorkflow(container).run({
          input: {
            affiliate_id: kept.affiliate_id,
            period_from: new Date(Date.now() - DAY),
            period_to: new Date(Date.now() + 30 * DAY),
          },
        })
        expect(Number(payout.amount)).toBe(100)
      })

      it("a reversal after approval is deducted from the payout", async () => {
        const { orderId, entry } = await placeAttributedOrder({ hold_days: 14 })
        await approveMaturedCommissionEntriesWorkflow(container).run({
          input: { now: new Date(Date.now() + 15 * DAY).toISOString() },
        })
        await andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

        expect(await payableOf(entry.affiliate_id)).toEqual([
          ["approved", 100],
          ["reversed", -100],
        ])
      })
    })
  },
})
