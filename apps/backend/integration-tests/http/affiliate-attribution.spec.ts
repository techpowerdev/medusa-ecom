import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import affiliateAttributionHandler from "../../src/subscribers/affiliate-attribution"

// secret ของ token มาจาก env เท่านั้น (medusa-config → module option) — ตั้งก่อน runner โหลด config
process.env.AFFILIATE_TOKEN_SECRET = "af3-integration-secret"

jest.setTimeout(300 * 1000)

const DAY = 24 * 60 * 60 * 1000

// AF-3 (spec 05): subscriber order.placed → attribution + commission entry
// complete cart ผ่าน completeCartWorkflow ตรง (ทดสอบ attribution ไม่ใช่ auth ของ store route)
// ราคา THB รวม VAT 7% (seed) → 1,070 = ฿1,000 ไม่รวมภาษี, 535 = ฿500
medusaIntegrationTestRunner({
  testSuite: ({ getContainer, dbConnection }) => {
    let container: MedusaContainer
    let affiliates: AffiliateModuleService
    let regionId: string
    let shippingOptionId: string
    let variantIn: string
    let variantOut: string
    let variant1000: string
    let collectionId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "af3-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "af3-test-password"
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
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })

      const [collection] = await container
        .resolve(Modules.PRODUCT)
        .createProductCollections([{ title: "AF-3 C", handle: "af3-c" }])
      collectionId = collection.id

      const product = (handle: string, amount: number, collection_id?: string) => ({
        title: handle,
        handle,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: options[0].shipping_profile_id,
        collection_id,
        options: [{ title: "Size", values: ["One"] }],
        variants: [
          {
            title: "One",
            manage_inventory: false,
            options: { Size: "One" },
            prices: [{ currency_code: "thb", amount }],
          },
        ],
        sales_channels: [{ id: channels[0].id }],
      })
      // รอ subscriber ของ product (search index) ให้เสร็จก่อน runner snapshot DB
      const eventBus = container.resolve(Modules.EVENT_BUS)
      const indexed = Promise.all(
        ["product.created", "product-variant.created"].map((name) =>
          TestEventUtils.waitSubscribersExecution(name, eventBus, { triggerCount: 3 })
        )
      )
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            product("af3-in-c", 535, collectionId),
            product("af3-not-c", 1070),
            product("af3-1000", 1070),
          ],
        },
      })
      await indexed
      ;[variantIn, variantOut, variant1000] = result.map((p) => p.variants[0].id)
    })

    const createAffiliate = (code: string, email = `${code}@example.com`) =>
      affiliates.createAffiliates({ email, name: code, code, status: "active" })

    const createProgram = (overrides: Record<string, unknown> = {}) =>
      affiliates.createAffiliatePrograms({
        name: "P",
        status: "published",
        starts_at: new Date(Date.now() - DAY),
        ends_at: new Date(Date.now() + DAY),
        commission_type: "percentage",
        commission_value: 10,
        scope: { all: true },
        attribution_window_days: 7,
        hold_days: 14,
        ...overrides,
      })

    const tokenFor = (affiliateId: string, clickedAgoMs = 60 * 1000) =>
      affiliates.signClickToken(affiliateId, new Date(Date.now() - clickedAgoMs))

    // รัน fn แล้วรอ subscriber ของ order.placed ทำงานเสร็จ
    const andWaitPlaced = async <T>(fn: () => Promise<T>) => {
      const done = TestEventUtils.waitSubscribersExecution("order.placed", container.resolve(Modules.EVENT_BUS))
      const result = await fn()
      await done
      return result
    }

    const placeOrder = async (opts: {
      items: { variant_id: string; quantity: number }[]
      token?: string
      email?: string
    }) => {
      seq += 1
      const email = opts.email ?? `af3-buyer-${seq}@example.com`
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          email,
          metadata: opts.token === undefined ? undefined : { affiliate_token: opts.token },
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: opts.items,
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
      const { result: order } = await andWaitPlaced(() =>
        completeCartWorkflow(container).run({ input: { id: cart.id } })
      )
      return { orderId: order.id, cartId: cart.id }
    }

    const attributionsOf = (orderId: string) => affiliates.listAffiliateAttributions({ order_id: orderId })
    const entriesOf = (orderId: string) =>
      affiliates.listAffiliateCommissionEntries({ order_id: orderId }, { order: { created_at: "ASC" } })

    // ส่ง event ซ้ำตรงเข้า subscriber (จำลอง event bus ส่งซ้ำ/พร้อมกัน)
    const redeliver = (orderId: string) =>
      affiliateAttributionHandler({ event: { name: "order.placed", data: { id: orderId } }, container } as Parameters<
        typeof affiliateAttributionHandler
      >[0])

    it("AC-1: an order of ฿1,000 within an active 10% program creates a pending ฿100 entry", async () => {
      const ann = await createAffiliate("ann")
      const program = await createProgram()

      const before = Date.now()
      const { orderId } = await placeOrder({
        items: [{ variant_id: variant1000, quantity: 1 }],
        token: await tokenFor(ann.id),
      })

      const [attribution] = await attributionsOf(orderId)
      expect(attribution).toEqual(
        expect.objectContaining({ affiliate_id: ann.id, program_id: program.id, attributed_at: expect.any(Date) })
      )
      const entries = await entriesOf(orderId)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual(
        expect.objectContaining({
          affiliate_id: ann.id,
          program_id: program.id,
          line_item_id: expect.any(String),
          amount: 100,
          currency: "thb",
          status: "pending",
        })
      )
      // matures_at = now + hold_days (14)
      const matures = entries[0].matures_at!.getTime()
      expect(matures).toBeGreaterThanOrEqual(before + 14 * DAY)
      expect(matures).toBeLessThanOrEqual(Date.now() + 14 * DAY)
    })

    it("AC-2: without an active program the attribution has program_id null and no entry", async () => {
      const ann = await createAffiliate("ann")
      // published แต่ช่วงเวลาผ่านไปแล้ว
      await createProgram({ starts_at: new Date(Date.now() - 3 * DAY), ends_at: new Date(Date.now() - DAY) })

      const { orderId } = await placeOrder({
        items: [{ variant_id: variant1000, quantity: 1 }],
        token: await tokenFor(ann.id),
      })

      expect(await attributionsOf(orderId)).toEqual([
        expect.objectContaining({ affiliate_id: ann.id, program_id: null }),
      ])
      expect(await entriesOf(orderId)).toEqual([])
    })

    it("AC-3: a click 10 days ago with attribution_window_days=7 is not attributed", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()

      const { orderId } = await placeOrder({
        items: [{ variant_id: variant1000, quantity: 1 }],
        token: await tokenFor(ann.id, 10 * DAY),
      })

      expect(await attributionsOf(orderId)).toEqual([])
      expect(await entriesOf(orderId)).toEqual([])
    })

    it("AC-4: a collection-scoped program pays only the line in the collection (฿500 → ฿50)", async () => {
      const ann = await createAffiliate("ann")
      const program = await createProgram({ scope: { collection_ids: [collectionId] } })

      const { orderId } = await placeOrder({
        items: [
          { variant_id: variantIn, quantity: 1 },
          { variant_id: variantOut, quantity: 1 },
        ],
        token: await tokenFor(ann.id),
      })

      const entries = await entriesOf(orderId)
      expect(entries.map((e) => [e.program_id, e.amount])).toEqual([[program.id, 50]])
    })

    it("AC-8: an order whose email matches the affiliate (case/spaces differ) gets no entry", async () => {
      const ann = await createAffiliate("ann", "  Ann.Self@Example.com ")
      await createProgram()

      const { orderId } = await placeOrder({
        items: [{ variant_id: variant1000, quantity: 1 }],
        token: await tokenFor(ann.id),
        email: "ann.self@example.com",
      })

      expect(await attributionsOf(orderId)).toHaveLength(1)
      expect(await entriesOf(orderId)).toEqual([])
    })

    it("AC-10: redelivering order.placed (twice concurrently, then again) keeps one attribution and one entry set", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()
      // วาง order โดยยังไม่มี token → subscriber รอบแรกไม่ทำอะไร แล้วใส่ token เพื่อให้รอบส่งซ้ำแข่งกันสร้างครั้งแรก
      const { orderId, cartId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
      expect(await attributionsOf(orderId)).toEqual([])
      await container
        .resolve(Modules.CART)
        .updateCarts(cartId, { metadata: { affiliate_token: await tokenFor(ann.id) } })

      // ตัวที่แพ้ race รอ lock แล้วเห็น attribution จึงหยุดเงียบ (กฎ 15) — ต้องไม่ throw
      const concurrent = await Promise.allSettled([redeliver(orderId), redeliver(orderId)])
      expect(concurrent.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"])
      await redeliver(orderId)

      expect(await attributionsOf(orderId)).toHaveLength(1)
      const entries = await entriesOf(orderId)
      expect(entries.map((e) => e.amount)).toEqual([100])
    })

    it("rule 15: when creating entries fails, compensation removes the attribution so a retry can attribute", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()
      const { orderId, cartId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
      await container
        .resolve(Modules.CART)
        .updateCarts(cartId, { metadata: { affiliate_token: await tokenFor(ann.id) } })
      // บังคับให้ insert entry ล้มที่ DB จริง (trigger หายเมื่อ runner restore DB ก่อน test ถัดไป)
      await dbConnection.raw(`
        CREATE FUNCTION af3_fail_entry() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'AF-3 forced entry failure'; END $$ LANGUAGE plpgsql;
        CREATE TRIGGER af3_fail_entry BEFORE INSERT ON affiliate_commission_entry
          FOR EACH ROW EXECUTE FUNCTION af3_fail_entry();
      `)

      try {
        // workflow โยน error เป็น plain object ({ message, ... }) ไม่ใช่ Error
        await expect(redeliver(orderId)).rejects.toEqual(
          expect.objectContaining({ message: expect.stringContaining("AF-3 forced entry failure") })
        )
      } finally {
        await dbConnection.raw(`
          DROP TRIGGER af3_fail_entry ON affiliate_commission_entry;
          DROP FUNCTION af3_fail_entry();
        `)
      }
      expect(await attributionsOf(orderId)).toEqual([])
      expect(await entriesOf(orderId)).toEqual([])

      await redeliver(orderId)
      expect(await attributionsOf(orderId)).toHaveLength(1)
      expect((await entriesOf(orderId)).map((e) => e.amount)).toEqual([100])
    })

    it("AC-11: a forged/tampered affiliate_token creates nothing and is logged", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      const warn = jest.spyOn(logger, "warn")
      const valid = await tokenFor(ann.id)
      const [, ts, sig] = valid.split(".")
      const other = await createAffiliate("mallory")

      try {
        for (const token of [`${other.id}.${ts}.${sig}`, `${ann.id}.${Number(ts) + 1}.${sig}`, "garbage"]) {
          const { orderId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }], token })
          expect(await attributionsOf(orderId)).toEqual([])
          expect(await entriesOf(orderId)).toEqual([])
          expect(warn).toHaveBeenCalledWith(expect.stringContaining(orderId))
        }
      } finally {
        warn.mockRestore()
      }
    })

    it("AC-17: an ended program inside its window gives attribution with program_id null and no entry", async () => {
      const ann = await createAffiliate("ann")
      await createProgram({ status: "ended" })

      const { orderId } = await placeOrder({
        items: [{ variant_id: variant1000, quantity: 1 }],
        token: await tokenFor(ann.id),
      })

      expect(await attributionsOf(orderId)).toEqual([
        expect.objectContaining({ affiliate_id: ann.id, program_id: null }),
      ])
      expect(await entriesOf(orderId)).toEqual([])
    })

    it("an order without affiliate_token is ignored", async () => {
      await createProgram()
      const { orderId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
      expect(await attributionsOf(orderId)).toEqual([])
    })

    // กฎ 24: เวลาอ้างอิงคือ order.created_at
    describe("attribution window by order.created_at (rule 24)", () => {
      it("AC-23: with P1 (15%, 7 days) and P2 (10%, 14 days) active, a click 10 days ago is attributed to P2 at 10%", async () => {
        const ann = await createAffiliate("ann")
        await createProgram({ name: "P1", commission_value: 15, attribution_window_days: 7 })
        const p2 = await createProgram({ name: "P2", commission_value: 10, attribution_window_days: 14 })

        const { orderId } = await placeOrder({
          items: [{ variant_id: variant1000, quantity: 1 }],
          token: await tokenFor(ann.id, 10 * DAY),
        })

        expect(await attributionsOf(orderId)).toEqual([expect.objectContaining({ program_id: p2.id })])
        expect((await entriesOf(orderId)).map((e) => [e.program_id, e.amount])).toEqual([[p2.id, 100]])
      })

      it("AC-23: without an active program, a click 20 days ago is attributed with program_id null; 31 days ago is not", async () => {
        const ann = await createAffiliate("ann")

        const recent = await placeOrder({
          items: [{ variant_id: variant1000, quantity: 1 }],
          token: await tokenFor(ann.id, 20 * DAY),
        })
        expect(await attributionsOf(recent.orderId)).toEqual([expect.objectContaining({ program_id: null })])
        expect(await entriesOf(recent.orderId)).toEqual([])

        const expired = await placeOrder({
          items: [{ variant_id: variant1000, quantity: 1 }],
          token: await tokenFor(ann.id, 31 * DAY),
        })
        expect(await attributionsOf(expired.orderId)).toEqual([])
      })

      it("AC-24: a click 6 days before order.created_at is attributed even when the event is processed 3 days late", async () => {
        const ann = await createAffiliate("ann")
        const program = await createProgram({ starts_at: new Date(Date.now() - 4 * DAY) })
        const { orderId, cartId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
        // order ถูกสั่งเมื่อ 3 วันก่อน (ย้อน created_at) และ click 6 วันก่อนหน้านั้น = 9 วันก่อนเวลาประมวลผล > window 7 วัน
        await dbConnection.raw(`UPDATE "order" SET created_at = now() - interval '3 days' WHERE id = ?`, [orderId])
        await container
          .resolve(Modules.CART)
          .updateCarts(cartId, { metadata: { affiliate_token: await tokenFor(ann.id, 9 * DAY) } })

        await redeliver(orderId)

        expect(await attributionsOf(orderId)).toEqual([expect.objectContaining({ program_id: program.id })])
        expect((await entriesOf(orderId)).map((e) => e.amount)).toEqual([100])
      })

      it("AC-14: a share link clicked while the program is upcoming earns for an order after starts_at, not before", async () => {
        const ann = await createAffiliate("ann")
        const program = await createProgram({
          starts_at: new Date(Date.now() + DAY),
          ends_at: new Date(Date.now() + 7 * DAY),
        })
        const clickedToday = await tokenFor(ann.id)

        const today = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }], token: clickedToday })
        expect(await attributionsOf(today.orderId)).toEqual([expect.objectContaining({ program_id: null })])
        expect(await entriesOf(today.orderId)).toEqual([])

        // สั่งพรุ่งนี้หลัง starts_at (ควบคุมเวลาด้วย order.created_at ตามกฎ 24) ด้วย click เดิมของวันนี้
        const tomorrow = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
        await dbConnection.raw(`UPDATE "order" SET created_at = now() + interval '2 days' WHERE id = ?`, [
          tomorrow.orderId,
        ])
        await container
          .resolve(Modules.CART)
          .updateCarts(tomorrow.cartId, { metadata: { affiliate_token: clickedToday } })

        await redeliver(tomorrow.orderId)

        expect(await attributionsOf(tomorrow.orderId)).toEqual([expect.objectContaining({ program_id: program.id })])
        expect((await entriesOf(tomorrow.orderId)).map((e) => e.amount)).toEqual([100])
      })
    })

    it("an expired token or an affiliate that is not active creates nothing and is logged at info level", async () => {
      const ann = await createAffiliate("ann")
      const suspended = await affiliates.createAffiliates({
        email: "sue@example.com",
        name: "sue",
        code: "sue",
        status: "suspended",
      })
      await createProgram()
      const info = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "info")

      try {
        for (const [token, reason] of [
          [await tokenFor(ann.id, 31 * DAY), "token_expired"],
          [await tokenFor(suspended.id), "affiliate_not_active"],
        ]) {
          const { orderId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }], token })
          expect(await attributionsOf(orderId)).toEqual([])
          expect(info).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${orderId}.*${reason}`)))
        }
      } finally {
        info.mockRestore()
      }
    })

    // owner 2026-10-26: order ที่ถูกยกเลิกแล้วไม่ถูก attribute (ตรวจใต้ lock affiliate-attribution:<order_id>)
    it("an order canceled before order.placed is processed gets no attribution and no entry", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()
      const { orderId, cartId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
      await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
      await container
        .resolve(Modules.CART)
        .updateCarts(cartId, { metadata: { affiliate_token: await tokenFor(ann.id) } })

      await redeliver(orderId)

      expect(await attributionsOf(orderId)).toEqual([])
      expect(await entriesOf(orderId)).toEqual([])
    })

    // AC-29 (กฎ 27): ตรวจ order.status หลังถือ lock affiliate-attribution:<order_id> แล้วปล่อยเมื่อจบ
    it("AC-29: attribution reads the order status only while holding affiliate-attribution:<order_id>", async () => {
      const ann = await createAffiliate("ann")
      await createProgram()
      const { orderId, cartId } = await placeOrder({ items: [{ variant_id: variant1000, quantity: 1 }] })
      await container
        .resolve(Modules.CART)
        .updateCarts(cartId, { metadata: { affiliate_token: await tokenFor(ann.id) } })

      const locking = container.resolve(Modules.LOCKING)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const calls: string[] = []
      const realAcquire = locking.acquire.bind(locking)
      const realRelease = locking.release.bind(locking)
      const realGraph = query.graph.bind(query) as (...args: unknown[]) => Promise<unknown>
      const acquire = jest.spyOn(locking, "acquire").mockImplementation((async (keys, ...rest) => {
        calls.push(`acquire ${[keys].flat().join(",")}`)
        return realAcquire(keys, ...rest)
      }) as typeof locking.acquire)
      const release = jest.spyOn(locking, "release").mockImplementation((async (keys, ...rest) => {
        calls.push(`release ${[keys].flat().join(",")}`)
        return realRelease(keys, ...rest)
      }) as typeof locking.release)
      const graph = jest.spyOn(query, "graph").mockImplementation((async (
        config: { entity: string; fields: string[] },
        ...rest: unknown[]
      ) => {
        if (config.entity === "order" && config.fields.includes("status")) {
          calls.push("read order.status")
        }
        return realGraph(config, ...rest)
      }) as unknown as typeof query.graph)

      try {
        await redeliver(orderId)
      } finally {
        acquire.mockRestore()
        release.mockRestore()
        graph.mockRestore()
      }

      const key = `affiliate-attribution:${orderId}`
      expect(calls.filter((c) => c.endsWith(key) || c === "read order.status")).toEqual([
        `acquire ${key}`,
        "read order.status",
        `release ${key}`,
      ])
      expect(await attributionsOf(orderId)).toHaveLength(1)
    })
  },
})
