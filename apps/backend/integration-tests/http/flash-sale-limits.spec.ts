import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import { FLASH_LIMIT_EXCEEDED, FLASH_SOLD_OUT } from "../../src/modules/flash_sale/errors"
import FlashSaleModuleService from "../../src/modules/flash_sale/service"

jest.setTimeout(300 * 1000)

// FS-3: spec 03 AC-2, AC-3, AC-7, AC-9, AC-10, AC-11 (b)
// จองสิทธิ์ flash ตอน complete cart (hook validate ของ completeCartWorkflow) ภายใต้ lock ต่อ (campaign, customer)

// AC-9: ทำให้ step หลัง hook validate ล้ม เฉพาะ cart ที่ test กำหนด
// hook orderCreated (หลัง authorize payment) มีจริงใน 2.22.1 แต่ถูก @ignore จาก type และไม่มีผู้ใช้อื่นในแอป
const failAfterValidate = new Set<string>()
const hooks = completeCartWorkflow.hooks as unknown as {
  orderCreated: (handler: (input: { cart_id: string }) => Promise<StepResponse<undefined>>) => void
}
hooks.orderCreated(async ({ cart_id }) => {
  if (failAfterValidate.has(cart_id)) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "FS-3 test: forced failure after validate")
  }
  return new StepResponse(undefined)
})

type CompleteResult =
  | { ok: true; orderId: string }
  | { ok: false; status?: number; type?: string; code?: string; message?: string }

// PROMO-2 (spec 03 กฎข้อ 13, AC-12 b): code ของเราถึง client เป็น 409 { type: "conflict", code, message }
const conflict = (code: string) => ({
  ok: false,
  status: 409,
  type: "conflict",
  code,
  message: expect.stringMatching(/\S/),
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let flashSale: FlashSaleModuleService
    let publishableKey: string
    // CORE-12 (ADR-013): complete ได้เฉพาะเจ้าของ cart — ใช้ token ของลูกค้าเจ้าของ cart แต่ละใบ
    const headersOfCustomer = new Map<string, { headers: Record<string, string> }>()
    const headersOfCart = new Map<string, { headers: Record<string, string> }>()
    let regionId: string
    let flashVariantId: string
    let shippingOptionId: string
    const activePromotionIds: string[] = []
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "fs3-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "fs3-test-password"
      await seedThailand({ container, args: [] })
      flashSale = container.resolve(FLASH_SALE_MODULE)

      publishableKey = await getPublishableKey(container)

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

    // แต่ละ test มี flash campaign ของตัวเอง — ปิด promotion ของ test ก่อนหน้าไม่ให้ตัวนับปนกัน
    afterEach(async () => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      await promotionModule.updatePromotions(
        activePromotionIds.splice(0).map((id) => ({ id, status: "inactive" as const }))
      )
      failAfterValidate.clear()
    })

    const setupFlashSale = async ({
      per_customer_limit = null,
      total_cap = null,
      units_sold = 0,
      max_quantity = 10,
    }: {
      per_customer_limit?: number | null
      total_cap?: number | null
      units_sold?: number
      max_quantity?: number
    }) => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      seq += 1
      const campaign = await promotionModule.createCampaigns({
        name: `FS-3 flash ${seq}`,
        campaign_identifier: `FS3-${seq}`,
      })
      const [promotion] = await promotionModule.createPromotions([
        {
          code: `FS3FLASH${seq}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity,
            value: 20,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [flashVariantId] }],
          },
        },
      ])
      activePromotionIds.push(promotion.id)
      await flashSale.createFlashSaleConfigs({
        campaign_id: campaign.id,
        per_customer_limit,
        total_cap,
        units_sold,
      })
      return campaign.id
    }

    const createCustomer = async () => {
      seq += 1
      // ลูกค้าที่มีบัญชีและล็อกอินได้ (ไม่มี guest, spec 01) — CORE-12: complete ด้วย token ของลูกค้าคนนี้
      const email = `fs3-${seq}@example.com`
      const customer = await registerCustomer(api, publishableKey, email, "fs3-buyer-password")
      headersOfCustomer.set(customer.customerId, storeHeadersFor(publishableKey, customer.token))
      return customer.customerId
    }

    // cart ของลูกค้าที่ล็อกอินพร้อม shipping + payment session (pp_system_default) — พร้อม complete
    const createReadyCart = async (customerId: string, quantity: number) => {
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customerId,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: flashVariantId, quantity }],
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
      headersOfCart.set(cart.id, headersOfCustomer.get(customerId)!)
      return cart.id
    }

    const complete = async (cartId: string): Promise<CompleteResult> =>
      api.post(`/store/carts/${cartId}/complete`, {}, headersOfCart.get(cartId)).then(
        ({ data }) =>
          data.type === "order"
            ? { ok: true as const, orderId: data.order.id }
            : { ok: false as const, status: 200, code: data.error?.type },
        (e: { response?: { status: number; data?: { type?: string; code?: string; message?: string } } }) => ({
          ok: false as const,
          status: e.response?.status,
          ...e.response?.data,
        })
      )

    const state = async (campaignId: string, customerIds: string[] = []) => {
      const [config] = await flashSale.listFlashSaleConfigs({ campaign_id: campaignId })
      const usages = await flashSale.listFlashSaleUsages({ campaign_id: campaignId })
      const usageOf = Object.fromEntries(usages.map((u) => [u.customer_id, u.units]))
      return {
        units_sold: config.units_sold,
        usage_total: usages.reduce((sum, u) => sum + u.units, 0),
        usage: customerIds.map((id) => usageOf[id] ?? 0),
      }
    }

    const orderOfCart = async (cartId: string) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "cart",
        fields: ["id", "completed_at", "order.id"],
        filters: { id: cartId },
      })
      return (data[0] as { order?: { id: string } | null }).order?.id ?? null
    }

    it("cart line gets the flash adjustment from the campaign promotion", async () => {
      await setupFlashSale({})
      const customer = await createCustomer()
      const cartId = await createReadyCart(customer, 1)
      const { data } = await api.get(`/store/carts/${cartId}?fields=*items.adjustments`, headersOfCart.get(cartId))
      expect(data.cart.items[0].adjustments).toHaveLength(1)
    })

    describe("AC-2 per_customer_limit=2", () => {
      it("(c) a new customer completing 2 units succeeds; usage and units_sold are booked immediately", async () => {
        const campaignId = await setupFlashSale({ per_customer_limit: 2 })
        const customer = await createCustomer()
        const cartId = await createReadyCart(customer, 2)

        const result = await complete(cartId)

        expect(result.ok).toBe(true)
        expect(await state(campaignId, [customer])).toEqual({ units_sold: 2, usage_total: 2, usage: [2] })
        const reservations = await flashSale.listFlashSaleReservations({ cart_id: cartId })
        expect(reservations).toEqual([
          expect.objectContaining({ campaign_id: campaignId, customer_id: customer, units: 2, released_at: null }),
        ])
      })

      it("(a) a customer who already bought 2 units cannot complete 1 more (FLASH_LIMIT_EXCEEDED)", async () => {
        const campaignId = await setupFlashSale({ per_customer_limit: 2 })
        const customer = await createCustomer()
        expect((await complete(await createReadyCart(customer, 2))).ok).toBe(true)

        const cartId = await createReadyCart(customer, 1)
        const result = await complete(cartId)

        expect(result).toEqual(conflict(FLASH_LIMIT_EXCEEDED))
        expect(await state(campaignId, [customer])).toEqual({ units_sold: 2, usage_total: 2, usage: [2] })
        expect(await orderOfCart(cartId)).toBeNull()
      })

      it("(b) counts the full line quantity (3) even when the promotion discounts max_quantity=1", async () => {
        const campaignId = await setupFlashSale({ per_customer_limit: 2, max_quantity: 1 })
        const customer = await createCustomer()
        const cartId = await createReadyCart(customer, 3)

        const result = await complete(cartId)

        expect(result).toEqual(conflict(FLASH_LIMIT_EXCEEDED))
        expect(await state(campaignId, [customer])).toEqual({ units_sold: 0, usage_total: 0, usage: [0] })
      })
    })

    it("AC-3 total_cap=10 and 10 units sold → the 11th checkout fails FLASH_SOLD_OUT", async () => {
      const campaignId = await setupFlashSale({ total_cap: 10 })
      for (let i = 0; i < 5; i++) {
        expect((await complete(await createReadyCart(await createCustomer(), 2))).ok).toBe(true)
      }
      expect((await state(campaignId)).units_sold).toEqual(10)

      const customer = await createCustomer()
      const cartId = await createReadyCart(customer, 1)
      const result = await complete(cartId)

      expect(result).toEqual(conflict(FLASH_SOLD_OUT))
      expect(await state(campaignId, [customer])).toEqual({ units_sold: 10, usage_total: 10, usage: [0] })
    })

    describe("AC-7 concurrency", () => {
      it("(a) 50 concurrent checkouts of different customers under total_cap=20 → exactly 20 succeed", async () => {
        const campaignId = await setupFlashSale({ total_cap: 20 })
        const cartIds: string[] = []
        for (let batch = 0; batch < 5; batch++) {
          cartIds.push(
            ...(await Promise.all(
              Array.from({ length: 10 }, async () => createReadyCart(await createCustomer(), 1))
            ))
          )
        }

        const results = await Promise.all(cartIds.map(complete))

        expect(results.filter((r) => r.ok)).toHaveLength(20)
        expect(results.filter((r) => !r.ok && r.code === FLASH_SOLD_OUT)).toHaveLength(30)
        expect(await state(campaignId)).toEqual({ units_sold: 20, usage_total: 20, usage: [] })
      })

      it("(b) one customer, 2 carts × 2 units, per_customer_limit=2, completed concurrently → 1 succeeds", async () => {
        const campaignId = await setupFlashSale({ per_customer_limit: 2 })
        const customer = await createCustomer()
        const cartIds = [await createReadyCart(customer, 2), await createReadyCart(customer, 2)]

        const results = await Promise.all(cartIds.map(complete))

        expect(results.filter((r) => r.ok)).toHaveLength(1)
        expect(results.filter((r) => !r.ok && r.code === FLASH_LIMIT_EXCEEDED)).toHaveLength(1)
        expect(await state(campaignId, [customer])).toEqual({ units_sold: 2, usage_total: 2, usage: [2] })
      })
    })

    it("AC-9 a failure after the hook reserved → usage, units_sold and the reservation are rolled back", async () => {
      const campaignId = await setupFlashSale({ per_customer_limit: 2, total_cap: 10 })
      const customer = await createCustomer()
      const cartId = await createReadyCart(customer, 2)
      failAfterValidate.add(cartId)

      const result = await complete(cartId)

      expect(result.ok).toBe(false)
      expect(await state(campaignId, [customer])).toEqual({ units_sold: 0, usage_total: 0, usage: [0] })
      expect(await flashSale.listFlashSaleReservations({ cart_id: cartId })).toEqual([])
      expect(await orderOfCart(cartId)).toBeNull()

      // คืนสิทธิ์แล้วจริง: cart ใหม่ของลูกค้าคนเดิมได้เต็ม limit
      expect((await complete(await createReadyCart(customer, 2))).ok).toBe(true)
      expect(await state(campaignId, [customer])).toEqual({ units_sold: 2, usage_total: 2, usage: [2] })
    })

    it("AC-10 completing an already completed cart returns the same order without booking again", async () => {
      const campaignId = await setupFlashSale({ per_customer_limit: 2 })
      const customer = await createCustomer()
      const cartId = await createReadyCart(customer, 2)
      const first = await complete(cartId)
      expect(first.ok).toBe(true)

      const second = await complete(cartId)

      expect(second).toEqual(first)
      expect(await state(campaignId, [customer])).toEqual({ units_sold: 2, usage_total: 2, usage: [2] })
      expect(await flashSale.listFlashSaleReservations({ cart_id: cartId })).toHaveLength(1)
    })

    it("AC-11 (b) units_sold=10 with total_cap lowered to 5 → a 1-unit checkout fails FLASH_SOLD_OUT", async () => {
      const campaignId = await setupFlashSale({ total_cap: 5, units_sold: 10 })
      const customer = await createCustomer()

      const result = await complete(await createReadyCart(customer, 1))

      expect(result).toEqual(conflict(FLASH_SOLD_OUT))
      expect(await state(campaignId, [customer])).toEqual({ units_sold: 10, usage_total: 0, usage: [0] })
    })

    it("a cart without flash sale config (plain campaign) completes without booking", async () => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      const campaign = await promotionModule.createCampaigns({
        name: "FS-3 plain",
        campaign_identifier: "FS3-PLAIN",
      })
      const [promotion] = await promotionModule.createPromotions([
        {
          code: "FS3PLAIN",
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 5,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [flashVariantId] }],
          },
        },
      ])
      activePromotionIds.push(promotion.id)
      const cartId = await createReadyCart(await createCustomer(), 3)

      expect((await complete(cartId)).ok).toBe(true)
      expect(await flashSale.listFlashSaleReservations({ cart_id: cartId })).toEqual([])
    })
  },
})
