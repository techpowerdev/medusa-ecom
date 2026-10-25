import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import FlashSaleModuleService from "../../src/modules/flash_sale/service"
import flashSaleReleaseHandler from "../../src/subscribers/flash-sale-release"

jest.setTimeout(300 * 1000)

// FS-2: spec 03 AC-5, AC-6 — order.canceled / refund เต็มจำนวน → คืน usage + units_sold ตาม reservation ครั้งเดียว
// complete cart ผ่าน completeCartWorkflow ตรง (ไม่ผ่าน store route) — test นี้ทดสอบการคืนค่า ไม่ใช่ auth ของ store
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let container: MedusaContainer
    let flashSale: FlashSaleModuleService
    let regionId: string
    let flashVariantId: string
    let shippingOptionId: string
    const activePromotionIds: string[] = []
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "fs2-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "fs2-test-password"
      await seedThailand({ container, args: [] })
      flashSale = container.resolve(FLASH_SALE_MODULE)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["handle", "variants.id", "variants.title"],
        filters: { handle: "t-shirt" },
      })
      flashVariantId = products[0].variants.find((v) => v.title === "L")!.id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "name"],
        filters: { name: "Standard" },
      })
      shippingOptionId = options[0].id
    })

    afterEach(async () => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      await promotionModule.updatePromotions(
        activePromotionIds.splice(0).map((id) => ({ id, status: "inactive" as const }))
      )
    })

    const setupFlashSale = async () => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      seq += 1
      const campaign = await promotionModule.createCampaigns({
        name: `FS-2 flash ${seq}`,
        campaign_identifier: `FS2-${seq}`,
      })
      const [promotion] = await promotionModule.createPromotions([
        {
          code: `FS2FLASH${seq}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 20,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [flashVariantId] }],
          },
        },
      ])
      activePromotionIds.push(promotion.id)
      await flashSale.createFlashSaleConfigs({ campaign_id: campaign.id, per_customer_limit: 5, total_cap: 10 })
      return campaign.id
    }

    // ลูกค้าที่มีบัญชีวาง order ที่มี flash `units` หน่วย (จองตอน complete โดย FS-3)
    const placeFlashOrder = async (units: number) => {
      seq += 1
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email: `fs2-${seq}@example.com`, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: flashVariantId, quantity: units }],
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
      const { result: order } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
      return { orderId: order.id, cartId: cart.id, customerId: customer.id }
    }

    const paymentOf = async (orderId: string) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["payment_collections.payments.id", "payment_collections.payments.amount"],
        filters: { id: orderId },
      })
      const payment = data[0].payment_collections![0]!.payments![0]!
      return { id: payment.id, amount: Number(payment.amount) }
    }

    const state = async (campaignId: string, customerId: string) => {
      const [config] = await flashSale.listFlashSaleConfigs({ campaign_id: campaignId })
      const [usage] = await flashSale.listFlashSaleUsages({ campaign_id: campaignId, customer_id: customerId })
      return { units_sold: config.units_sold, usage: usage?.units ?? 0 }
    }

    const releasedAt = async (cartId: string) =>
      (await flashSale.listFlashSaleReservations({ cart_id: cartId })).map((r) => r.released_at)

    // รัน fn แล้วรอ subscriber ของ event ทำงานเสร็จ
    const andWait = async (eventName: string, fn: () => Promise<unknown>) => {
      const done = TestEventUtils.waitSubscribersExecution(eventName, container.resolve(Modules.EVENT_BUS))
      await fn()
      await done
    }

    const cancel = (orderId: string) =>
      andWait("order.canceled", () => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

    const capture = async (orderId: string) => {
      const payment = await paymentOf(orderId)
      await capturePaymentWorkflow(container).run({ input: { payment_id: payment.id } })
      return payment
    }

    const refund = (paymentId: string, amount?: number) =>
      andWait("payment.refunded", () =>
        refundPaymentWorkflow(container).run({ input: { payment_id: paymentId, amount } })
      )

    // ส่ง event ซ้ำตรงเข้า subscriber (จำลอง event bus ส่งซ้ำ/พร้อมกัน)
    const redeliver = (name: string, id: string) =>
      flashSaleReleaseHandler({ event: { name, data: { id } }, container } as Parameters<
        typeof flashSaleReleaseHandler
      >[0])

    describe("AC-5", () => {
      it("order.canceled of an order with 2 flash units returns usage and units_sold by 2", async () => {
        const campaignId = await setupFlashSale()
        const { orderId, cartId, customerId } = await placeFlashOrder(2)
        expect(await state(campaignId, customerId)).toEqual({ units_sold: 2, usage: 2 })

        await cancel(orderId)

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 0, usage: 0 })
        expect(await releasedAt(cartId)).toEqual([expect.any(Date)])
      })

      it("a full refund of the order gives the same result", async () => {
        const campaignId = await setupFlashSale()
        const { orderId, cartId, customerId } = await placeFlashOrder(2)
        const payment = await capture(orderId)

        await refund(payment.id)

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 0, usage: 0 })
        expect(await releasedAt(cartId)).toEqual([expect.any(Date)])
      })

      // AC-5 (a): เกณฑ์เดียว refund รวม >= capture รวม ไม่ว่ามาจาก cancel, return หรือคืนด้วยมือ
      it("a refund 0.01 short of the captured amount does not return anything (rule 10)", async () => {
        const campaignId = await setupFlashSale()
        const { orderId, cartId, customerId } = await placeFlashOrder(2)
        const payment = await capture(orderId)

        await refund(payment.id, Number((payment.amount - 0.01).toFixed(2)))

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 2, usage: 2 })
        expect(await releasedAt(cartId)).toEqual([null])
      })

      it("refunds in two parts (60% then the rest) return once, after the second part", async () => {
        const campaignId = await setupFlashSale()
        const { orderId, cartId, customerId } = await placeFlashOrder(2)
        const payment = await capture(orderId)
        const first = Number((payment.amount * 0.6).toFixed(2))

        await refund(payment.id, first)
        expect(await state(campaignId, customerId)).toEqual({ units_sold: 2, usage: 2 })

        await refund(payment.id, Number((payment.amount - first).toFixed(2)))
        expect(await state(campaignId, customerId)).toEqual({ units_sold: 0, usage: 0 })
        expect(await releasedAt(cartId)).toEqual([expect.any(Date)])
      })
    })

    describe("AC-6 returns only once", () => {
      it("order.canceled delivered twice in sequence", async () => {
        const campaignId = await setupFlashSale()
        const other = await placeFlashOrder(1)
        const { orderId, customerId } = await placeFlashOrder(2)
        await cancel(orderId)

        await redeliver("order.canceled", orderId)

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 1, usage: 0 })
        expect(await state(campaignId, other.customerId)).toEqual({ units_sold: 1, usage: 1 })
      })

      it("order.canceled delivered twice concurrently", async () => {
        const campaignId = await setupFlashSale()
        await placeFlashOrder(1)
        const { orderId, customerId } = await placeFlashOrder(2)

        await Promise.all([redeliver("order.canceled", orderId), redeliver("order.canceled", orderId)])

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 1, usage: 0 })
      })

      it("full refund followed by cancel", async () => {
        const campaignId = await setupFlashSale()
        await placeFlashOrder(1)
        const { orderId, customerId } = await placeFlashOrder(2)
        const payment = await capture(orderId)
        await refund(payment.id)

        await cancel(orderId)

        expect(await state(campaignId, customerId)).toEqual({ units_sold: 1, usage: 0 })
      })
    })

    it("canceling an order without flash units is a no-op", async () => {
      const { orderId, cartId } = await placeFlashOrder(1)

      await cancel(orderId)

      expect(await flashSale.listFlashSaleReservations({ cart_id: cartId })).toEqual([])
    })
  },
})
