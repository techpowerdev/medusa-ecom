import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import type FlashSaleModuleService from "../../src/modules/flash_sale/service"

jest.setTimeout(300 * 1000)

// FS-20: spec 03 กฎข้อ 25, AC-27 — GET /store/customers/me/flash-sales/allowance
// limited = แคมเปญ per_customer_limit 2 (t-shirt L), unlimited = แคมเปญไม่จำกัด (t-shirt M), t-shirt S ไม่อยู่ในแคมเปญ

const DAY = 24 * 60 * 60 * 1000

type Allowance = {
  variant_id: string
  campaign_id: string
  per_customer_limit: number | null
  used_units: number
  remaining_for_customer: number | null
}

// ห่อ error ของ axios ไม่ให้ object circular หลุดออกจาก test (CLAUDE.md)
const statusOf = (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e: { response?: { status?: number } }) => e?.response?.status ?? 0
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let publishableKey: string
    let buyer: { token: string; customerId: string }
    let other: { token: string; customerId: string }
    let regionId: string
    let shippingOptionId: string
    let limitedVariantId: string
    let unlimitedVariantId: string
    let outsideVariantId: string
    let limitedCampaignId: string
    let unlimitedCampaignId: string

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "fs20-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "fs20-test-password"
      await seedThailand({ container, args: [] })
      publishableKey = (await getPublishableKey(container))!
      buyer = await registerCustomer(api, publishableKey, "fs20-buyer@example.com", "fs20-password")
      other = await registerCustomer(api, publishableKey, "fs20-other@example.com", "fs20-password")

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["handle", "variants.id", "variants.title"],
        filters: { handle: "t-shirt" },
      })
      const variants = products[0].variants
      limitedVariantId = variants.find((v) => v.title === "L")!.id
      unlimitedVariantId = variants.find((v) => v.title === "M")!.id
      outsideVariantId = variants.find((v) => v.title === "S")!.id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      shippingOptionId = options[0].id

      const promotionModule = container.resolve(Modules.PROMOTION)
      const now = Date.now()
      const campaign = (identifier: string) =>
        promotionModule.createCampaigns({
          name: `FS-20 ${identifier}`,
          campaign_identifier: identifier,
          starts_at: new Date(now - DAY),
          ends_at: new Date(now + DAY),
        })
      limitedCampaignId = (await campaign("FS20-LIMITED")).id
      unlimitedCampaignId = (await campaign("FS20-UNLIMITED")).id

      const flashPromotion = (code: string, campaign_id: string, variantId: string) => ({
        code,
        type: "standard" as const,
        status: "active" as const,
        is_automatic: true,
        campaign_id,
        application_method: {
          type: "percentage" as const,
          target_type: "items" as const,
          allocation: "each" as const,
          max_quantity: 10,
          value: 20,
          target_rules: [{ attribute: "items.variant_id", operator: "in" as const, values: [variantId] }],
        },
      })
      await promotionModule.createPromotions([
        flashPromotion("FS20LIMITED", limitedCampaignId, limitedVariantId),
        flashPromotion("FS20UNLIMITED", unlimitedCampaignId, unlimitedVariantId),
      ])

      const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
      await flashSale.createFlashSaleConfigs([
        { campaign_id: limitedCampaignId, per_customer_limit: 2 },
        { campaign_id: unlimitedCampaignId },
      ])
    })

    // ลูกค้าวาง order flash `units` ชิ้น (FS-3 จองสิทธิ์ตอน complete)
    const placeFlashOrder = async (customerId: string, units: number) => {
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
          items: [{ variant_id: limitedVariantId, quantity: units }],
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
      return order.id
    }

    const url = (variantIds: string[], region: string | null = regionId) =>
      "/store/customers/me/flash-sales/allowance?" +
      [...(region ? [`region_id=${region}`] : []), ...variantIds.map((id) => `variant_ids[]=${id}`)].join("&")

    const allowances = async (customer: { token: string }) => {
      const { status, data, headers } = await api
        .get(url([limitedVariantId, unlimitedVariantId, outsideVariantId]), storeHeadersFor(publishableKey, customer.token))
        .catch((e) => {
          throw new Error(`${e?.response?.status} ${JSON.stringify(e?.response?.data)}`)
        })
      expect(status).toBe(200)
      expect(headers["cache-control"]).toBe("private, no-store")
      const list = data.allowances as Allowance[]
      return Object.fromEntries(list.map((a) => [a.variant_id, a]))
    }

    it("per-customer remaining after buying 1 of limit 2; other customer still 2; unlimited → null; outside campaign omitted", async () => {
      await placeFlashOrder(buyer.customerId, 1)

      const mine = await allowances(buyer)
      expect(Object.keys(mine).sort()).toEqual([limitedVariantId, unlimitedVariantId].sort())
      expect(mine[limitedVariantId]).toEqual({
        variant_id: limitedVariantId,
        campaign_id: limitedCampaignId,
        per_customer_limit: 2,
        used_units: 1,
        remaining_for_customer: 1,
      })
      expect(mine[unlimitedVariantId]).toEqual({
        variant_id: unlimitedVariantId,
        campaign_id: unlimitedCampaignId,
        per_customer_limit: null,
        used_units: 0,
        remaining_for_customer: null,
      })
      expect(mine[outsideVariantId]).toBeUndefined()

      const theirs = await allowances(other)
      expect(theirs[limitedVariantId]).toMatchObject({ used_units: 0, remaining_for_customer: 2 })
    })

    it("canceling the order returns the quota (FS-2) → remaining back to 2", async () => {
      const orderId = await placeFlashOrder(buyer.customerId, 1)
      const done = TestEventUtils.waitSubscribersExecution("order.canceled", container.resolve(Modules.EVENT_BUS))
      await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
      await done

      const mine = await allowances(buyer)
      expect(mine[limitedVariantId]).toMatchObject({ used_units: 0, remaining_for_customer: 2 })
    })

    it("401 without a customer token", async () => {
      expect(await statusOf(api.get(url([limitedVariantId]), storeHeadersFor(publishableKey)))).toBe(401)
    })

    it("400 without region_id, without variant_ids, or with more than 24 variant_ids", async () => {
      const headers = storeHeadersFor(publishableKey, buyer.token)
      expect(await statusOf(api.get(url([limitedVariantId], null), headers))).toBe(400)
      expect(await statusOf(api.get(url([]), headers))).toBe(400)
      const many = Array.from({ length: 25 }, (_, i) => `variant_${i}`)
      expect(await statusOf(api.get(url(many), headers))).toBe(400)
    })
  },
})
