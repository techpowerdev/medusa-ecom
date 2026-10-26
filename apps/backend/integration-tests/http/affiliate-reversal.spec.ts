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
  dismissItemReturnRequestWorkflow,
  receiveItemReturnRequestWorkflow,
  refundPaymentWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import affiliateAttributionHandler from "../../src/subscribers/affiliate-attribution"
import affiliateReversalHandler from "../../src/subscribers/affiliate-reversal"
import affiliateMaturityJob, { config as maturityJobConfig } from "../../src/jobs/affiliate-maturity"
import { approveMaturedCommissionEntriesWorkflow } from "../../src/workflows/affiliate/approve-matured-entries"
import {
  createAffiliatePayoutWorkflow,
  markAffiliatePayoutPaidWorkflow,
} from "../../src/workflows/affiliate/affiliate-payout"
import { reverseAffiliateCommissionWorkflow } from "../../src/workflows/affiliate/reverse-commission"

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
    let variant1000b: string
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
      const product = (handle: string) => ({
        title: handle,
        handle,
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
      })
      const { result } = await createProductsWorkflow(container).run({
        input: { products: [product("af4-1000"), product("af4-1000-b")] },
      })
      await indexed
      ;[variant1000, variant1000b] = result.map((p) => p.variants[0].id)
    })

    const andWait = async <T>(eventName: string, fn: () => Promise<T>) => {
      const done = TestEventUtils.waitSubscribersExecution(eventName, container.resolve(Modules.EVENT_BUS))
      const result = await fn()
      await done
      return result
    }

    // order ฿1,000 × quantity ที่ attribute ให้ Ann ในโปรแกรม commission_value% (default 10 → ฿100 ต่อชิ้น)
    // second_line = เพิ่ม line ของสินค้าอีกตัว (quantity 1)
    const placeAttributedOrder = async (
      opts: {
        quantity?: number
        hold_days?: number
        affiliate_id?: string
        commission_value?: number
        second_line?: boolean
        without_token?: boolean
      } = {}
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
        commission_value: opts.commission_value ?? 10,
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
          metadata: opts.without_token
            ? undefined
            : { affiliate_token: await affiliates.signClickToken(ann.id, new Date(Date.now() - 60 * 1000)) },
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [
            { variant_id: variant1000, quantity: opts.quantity ?? 1 },
            ...(opts.second_line ? [{ variant_id: variant1000b, quantity: 1 }] : []),
          ],
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
      if (opts.without_token) {
        return { orderId: order.id, cartId: cart.id, affiliateId: ann.id, entry: undefined as never }
      }
      const entries = await entriesOf(order.id)
      expect(entries).toHaveLength(opts.second_line ? 2 : 1)
      expect(entries.every((e) => e.status === "pending")).toBe(true)
      const entry = entries.find((e) => Number(e.amount) === 10 * (opts.commission_value ?? 10) * (opts.quantity ?? 1))!
      expect(entry).toBeDefined()
      return { orderId: order.id, cartId: cart.id, affiliateId: ann.id, entry }
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

    const capturedOf = async (paymentId: string) => {
      const [payment] = await container
        .resolve(Modules.PAYMENT)
        .listPayments({ id: paymentId }, { relations: ["captures"] })
      return payment.captures!.reduce((total, c) => total + Number(c.amount), 0)
    }

    // ส่ง event ซ้ำตรงเข้า subscriber reversal
    const redeliverReversal = (name: string, data: Record<string, string>) =>
      affiliateReversalHandler({ event: { name, data }, container } as Parameters<typeof affiliateReversalHandler>[0])

    // บันทึกลำดับ acquire/release ของ Locking module และการอ่าน order ที่มี field `marker`
    const spyLockAndOrderReads = (marker: string) => {
      const locking = container.resolve(Modules.LOCKING)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const log: string[] = []
      const realAcquire = locking.acquire.bind(locking)
      const realRelease = locking.release.bind(locking)
      const realGraph = query.graph.bind(query) as (...args: unknown[]) => Promise<unknown>
      const spies = [
        jest.spyOn(locking, "acquire").mockImplementation((async (keys, ...rest) => {
          log.push(`acquire ${[keys].flat().join(",")}`)
          return realAcquire(keys, ...rest)
        }) as typeof locking.acquire),
        jest.spyOn(locking, "release").mockImplementation((async (keys, ...rest) => {
          log.push(`release ${[keys].flat().join(",")}`)
          return realRelease(keys, ...rest)
        }) as typeof locking.release),
        jest.spyOn(query, "graph").mockImplementation((async (
          config: { entity: string; fields: string[] },
          ...rest: unknown[]
        ) => {
          if (config.entity === "order" && config.fields.includes(marker)) {
            log.push("read order")
          }
          return realGraph(config, ...rest)
        }) as unknown as typeof query.graph),
      ]
      return { log, restore: () => spies.forEach((spy) => spy.mockRestore()) }
    }

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

      it("AC-31: a partial refund reverses nothing; refunding the rest reverses every line to net 0; redelivery adds nothing", async () => {
        const { orderId } = await placeAttributedOrder({ second_line: true })
        const paymentId = await paymentOf(orderId)
        await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })
        const captured = await capturedOf(paymentId)

        await andWait("payment.refunded", () =>
          refundPaymentWorkflow(container).run({ input: { payment_id: paymentId, amount: 100 } })
        )
        expect((await entriesOf(orderId)).map((e) => e.status)).toEqual(["pending", "pending"])

        await andWait("payment.refunded", () =>
          refundPaymentWorkflow(container).run({ input: { payment_id: paymentId, amount: captured - 100 } })
        )
        const entries = await entriesOf(orderId)
        const reversed = entries.filter((e) => e.status === "reversed")
        expect(reversed.map((e) => [e.line_item_id, Number(e.amount), e.reason]).sort()).toEqual(
          entries
            .filter((e) => e.status === "pending")
            .map((e) => [e.line_item_id, -Number(e.amount), "refunded"])
            .sort()
        )
        expect(await netOf(orderId)).toBe(0)

        await redeliverReversal("payment.refunded", { id: paymentId })
        await redeliverReversal("order.canceled", { id: orderId })
        expect(await entriesOf(orderId)).toHaveLength(4)
      })

      it("a refunded payment without an order is a no-op (no lock, no entry)", async () => {
        const { result } = await reverseAffiliateCommissionWorkflow(container).run({
          input: { payment_id: "pay_does_not_exist", reason: "refunded" },
        })
        expect(result).toEqual([])
      })

      it("order.canceled reverses the whole commission", async () => {
        const { orderId } = await placeAttributedOrder()

        await andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

        expect((await entriesOf(orderId)).map((e) => [e.status, e.amount, e.reason])).toEqual([
          ["pending", 100, null],
          ["reversed", -100, "canceled"],
        ])
      })

      // flow คืนของของ admin: ขอคืน → ยืนยัน → รับของ (ปกติ/damaged) → ยืนยันรับ (emit order.return_received)
      const returnItems = async (orderId: string, lineItemId: string, received: number, dismissed = 0) => {
        const { result: begun } = await beginReturnOrderWorkflow(container).run({
          input: { order_id: orderId, location_id: locationId },
        })
        const return_id = begun.return_id!
        await requestItemReturnWorkflow(container).run({
          input: { return_id, items: [{ id: lineItemId, quantity: received + dismissed }] },
        })
        await confirmReturnRequestWorkflow(container).run({ input: { return_id } })
        await beginReceiveReturnWorkflow(container).run({ input: { return_id } })
        if (received) {
          await receiveItemReturnRequestWorkflow(container).run({
            input: { return_id, items: [{ id: lineItemId, quantity: received }] },
          })
        }
        if (dismissed) {
          await dismissItemReturnRequestWorkflow(container).run({
            input: { return_id, items: [{ id: lineItemId, quantity: dismissed }] },
          })
        }
        await andWait("order.return_received", () =>
          confirmReturnReceiveWorkflow(container).run({ input: { return_id } })
        )
      }

      // AC-30 (กฎ 28c): ฿4,000 × 2.5% = entry ฿100 ของ line qty 4
      const placeQty4 = async () => {
        const placed = await placeAttributedOrder({ quantity: 4, commission_value: 2.5 })
        await createOrderFulfillmentWorkflow(container).run({
          input: { order_id: placed.orderId, items: [{ id: placed.entry.line_item_id!, quantity: 4 }] },
        })
        return placed
      }
      const ledgerOf = async (orderId: string) =>
        (await entriesOf(orderId)).map((e) => [e.status, Number(e.amount), e.reason])

      it("AC-30: returning 1 of 4 reverses −฿25, returning the other 3 reverses −฿75 and the line nets 0", async () => {
        const { orderId, entry } = await placeQty4()

        await returnItems(orderId, entry.line_item_id!, 1)
        expect(await ledgerOf(orderId)).toEqual([
          ["pending", 100, null],
          ["reversed", -25, "returned"],
        ])

        await returnItems(orderId, entry.line_item_id!, 3)
        expect(await ledgerOf(orderId)).toEqual([
          ["pending", 100, null],
          ["reversed", -25, "returned"],
          ["reversed", -75, "returned"],
        ])
        expect(await netOf(orderId)).toBe(0)
      })

      it("AC-30: one return with 1 received + 1 dismissed (damaged) of 4 reverses −฿50", async () => {
        const { orderId, entry } = await placeQty4()

        await returnItems(orderId, entry.line_item_id!, 1, 1)

        expect(await ledgerOf(orderId)).toEqual([
          ["pending", 100, null],
          ["reversed", -50, "returned"],
        ])
      })

      // AC-29 (กฎ 27): reversal จาก cancel อ่าน order ขณะถือ lock affiliate-attribution:<order_id>
      it("AC-29: the reversal of a cancel reads the order only while holding affiliate-attribution:<order_id>", async () => {
        const { orderId } = await placeAttributedOrder()
        const calls = spyLockAndOrderReads("items.detail.return_received_quantity")

        try {
          await andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))
        } finally {
          calls.restore()
        }

        const key = `affiliate-attribution:${orderId}`
        expect(calls.log.filter((c) => c.endsWith(key) || c === "read order")).toEqual([
          `acquire ${key}`,
          "read order",
          `release ${key}`,
        ])
        expect(await netOf(orderId)).toBe(0)
      })
    })

    // AC-29 (กฎ 27): attribution กับ cancel ของ order เดียวกันพร้อมกัน — ไม่ว่าลำดับใดผลรวมต้องเป็น 0 และไม่มี pending ค้าง
    it("AC-29: attribution racing a cancel of the same order nets 0 and leaves no unreversed pending entry", async () => {
      for (let round = 0; round < 3; round++) {
        const { orderId, cartId, affiliateId } = await placeAttributedOrder({ without_token: true })
        await container.resolve(Modules.CART).updateCarts(cartId, {
          metadata: { affiliate_token: await affiliates.signClickToken(affiliateId, new Date(Date.now() - 60 * 1000)) },
        })

        const results = await Promise.allSettled([
          affiliateAttributionHandler({
            event: { name: "order.placed", data: { id: orderId } },
            container,
          } as Parameters<typeof affiliateAttributionHandler>[0]),
          andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } })),
        ])
        expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"])

        const entries = await entriesOf(orderId)
        expect(await netOf(orderId)).toBe(0)
        const reversedLines = new Set(entries.filter((e) => e.status === "reversed").map((e) => e.line_item_id))
        expect(entries.filter((e) => e.status === "pending" && !reversedLines.has(e.line_item_id))).toEqual([])
      }
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

      it("approves matured entries in batches", async () => {
        const { orderId: first } = await placeAttributedOrder({ hold_days: 0 })
        const { orderId: second } = await placeAttributedOrder({ hold_days: 0 })

        await approveMaturedCommissionEntriesWorkflow(container).run({
          input: { now: new Date().toISOString(), batch_size: 1 },
        })

        expect([...(await entriesOf(first)), ...(await entriesOf(second))].map((e) => e.status)).toEqual([
          "approved",
          "approved",
        ])
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

      // AC-28 (กฎ 19): ledger ตรงตาม spec — reversed เข้า payout เฉพาะเมื่อต้นทางของ line เดียวกันเป็น approved/paid
      it("AC-28: payouts pick a reversal only once its source line is approved or paid (entry_ids asserted)", async () => {
        const ann = await affiliates.createAffiliates({ email: "ac28@example.com", name: "Ann", code: "ac28", status: "active" })
        const later = new Date(Date.now() + 14 * DAY)
        const entry = (order_id: string, amount: number, status: "pending" | "approved" | "reversed") => ({
          affiliate_id: ann.id,
          program_id: "affprog_ac28",
          order_id,
          line_item_id: `li_${order_id}`,
          amount,
          currency: "thb",
          status,
          matures_at: status === "pending" ? later : null,
        })
        const [, r1, e2, r2, e3, r3, e4] = await affiliates.createAffiliateCommissionEntries([
          entry("o1", 100, "pending"),
          entry("o1", -100, "reversed"),
          entry("o2", 50, "approved"),
          entry("o2", -20, "reversed"),
          entry("o3", 100, "pending"),
          entry("o3", -40, "reversed"),
          entry("o4", 70, "approved"),
        ])
        const payout = async () => {
          const { result } = await createAffiliatePayoutWorkflow(container).run({
            input: {
              affiliate_id: ann.id,
              period_from: new Date(Date.now() - DAY),
              period_to: new Date(Date.now() + 30 * DAY),
            },
          })
          return { amount: Number(result.amount), entry_ids: [...(result.entry_ids as string[])].sort() }
        }

        // L1 คืนเต็มขณะ pending, L3 ยังไม่ครบ hold → ไม่มี R1, E3, R3
        const first = await payout()
        expect(first).toEqual({ amount: 100, entry_ids: [e2.id, r2.id, e4.id].sort() })
        expect(first.entry_ids).not.toContain(r1.id)
        const [firstPayout] = await affiliates.listAffiliatePayouts({ affiliate_id: ann.id })
        await markAffiliatePayoutPaidWorkflow(container).run({ input: { id: firstPayout.id } })

        // maturity approve E3 (สุทธิ ฿60 > 0) + ต้นทาง E4 ที่ paid แล้วมี reversal ใหม่ → รอบถัดไปได้ E3 + R3 + R4
        await approveMaturedCommissionEntriesWorkflow(container).run({ input: { now: new Date(later.getTime() + 1000).toISOString() } })
        const [r4] = await affiliates.createAffiliateCommissionEntries([entry("o4", -10, "reversed")])

        expect(await payout()).toEqual({ amount: 50, entry_ids: [e3.id, r3.id, r4.id].sort() })
        expect((await affiliates.listAffiliateCommissionEntries({ id: [e4.id, r1.id] })).map((e) => [e.id, e.status]).sort()).toEqual(
          [
            [e4.id, "paid"],
            [r1.id, "reversed"],
          ].sort()
        )
      })
    })
  },
})
