import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { exclusiveAutomaticRule } from "../../src/lib/promotion-exclusivity"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import type FlashSaleModuleService from "../../src/modules/flash_sale/service"

jest.setTimeout(300 * 1000)

// FS-4: spec 03 "API" + AC-4 (ส่วน API) — GET /store/flash-sales/active
// F = flash promotion (automatic + exclusivity rule, กฎข้อ 6g), N = automatic ที่ campaign ไม่มี FlashSaleConfig

const DAY = 24 * 60 * 60 * 1000

type FlashSale = {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  banner_text: string | null
  show_countdown: boolean
  show_remaining: boolean
  remaining_usage: number | null
}
type VariantPreview = {
  variant_id: string
  currency_code: string
  original_price: number
  flash_price: number | null
  campaign_id: string | null
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let storeHeaders: { headers: Record<string, string> }
    let regionId: string
    let flashVariantId: string // t-shirt L → F (target ตาม product)
    let otherVariantId: string // sweatshirt M → N เท่านั้น
    let activeCampaignId: string
    let expiredCampaignId: string
    let plainCampaignId: string

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "fs4-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "fs4-test-password"
      await seedThailand({ container, args: [] })

      const token = await getPublishableKey(container)
      storeHeaders = { headers: { "x-publishable-api-key": token! } }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "handle", "variants.id", "variants.title"],
        filters: { handle: ["t-shirt", "sweatshirt"] },
      })
      const tshirt = products.find((p) => p.handle === "t-shirt")!
      const sweatshirt = products.find((p) => p.handle === "sweatshirt")!
      flashVariantId = tshirt.variants.find((v) => v.title === "L")!.id
      otherVariantId = sweatshirt.variants.find((v) => v.title === "M")!.id

      const promotionModule = container.resolve(Modules.PROMOTION)
      const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
      const now = Date.now()

      // สร้างทีละตัว — createCampaigns แบบ array ไม่รับประกันลำดับผลลัพธ์
      activeCampaignId = (
        await promotionModule.createCampaigns({
          name: "FS-4 flash active",
          campaign_identifier: "FS4-ACTIVE",
          starts_at: new Date(now - DAY),
          ends_at: new Date(now + DAY),
          budget: { type: "usage", limit: 10 },
        })
      ).id
      expiredCampaignId = (
        await promotionModule.createCampaigns({
          name: "FS-4 flash expired",
          campaign_identifier: "FS4-EXPIRED",
          starts_at: new Date(now - 2 * DAY),
          ends_at: new Date(now - DAY),
        })
      ).id
      plainCampaignId = (
        await promotionModule.createCampaigns({
          name: "FS-4 not a flash sale",
          campaign_identifier: "FS4-PLAIN",
          starts_at: new Date(now - DAY),
          ends_at: new Date(now + DAY),
        })
      ).id

      const automatic = (code: string, campaign_id: string, value: number, productId: string, exclusive: boolean) => ({
        code,
        type: "standard" as const,
        status: "active" as const,
        is_automatic: true,
        campaign_id,
        rules: exclusive ? [exclusiveAutomaticRule()] : [],
        application_method: {
          type: "percentage" as const,
          target_type: "items" as const,
          allocation: "each" as const,
          max_quantity: 1,
          value,
          target_rules: [{ attribute: "items.product.id", operator: "in" as const, values: [productId] }],
        },
      })
      await promotionModule.createPromotions([
        automatic("FS4FLASH20", activeCampaignId, 20, tshirt.id, true),
        automatic("FS4EXPIRED50", expiredCampaignId, 50, tshirt.id, true),
        automatic("FS4AUTO10", plainCampaignId, 10, tshirt.id, false),
        automatic("FS4AUTO10B", plainCampaignId, 10, sweatshirt.id, false),
      ])

      await flashSale.createFlashSaleConfigs([
        {
          campaign_id: activeCampaignId,
          per_customer_limit: 2,
          show_countdown: true,
          show_remaining: true,
          banner_text: "Flash sale!",
        },
        { campaign_id: expiredCampaignId, banner_text: "Over" },
      ])
    })

    it("lists only running flash campaigns with countdown data, publicly (no customer auth)", async () => {
      const { status, data } = await api.get("/store/flash-sales/active", storeHeaders)

      expect(status).toBe(200)
      const ids = (data.flash_sales as FlashSale[]).map((f) => f.id)
      expect(ids).toEqual([activeCampaignId])
      expect(ids).not.toContain(expiredCampaignId)
      expect(ids).not.toContain(plainCampaignId)

      const [sale] = data.flash_sales as FlashSale[]
      expect(sale).toEqual({
        id: activeCampaignId,
        name: "FS-4 flash active",
        starts_at: expect.any(String),
        ends_at: expect.any(String),
        banner_text: "Flash sale!",
        show_countdown: true,
        show_remaining: true,
        remaining_usage: 10,
      })
      expect(new Date(sale.ends_at!).getTime()).toBeGreaterThan(Date.now())
      expect(data.variants).toEqual([])
    })

    it("returns flash_price from the Promotion module for exclusive flash promotions only", async () => {
      const { status, data } = await api.get(
        `/store/flash-sales/active?region_id=${regionId}&variant_ids[]=${flashVariantId}&variant_ids[]=${otherVariantId}`,
        storeHeaders
      )

      expect(status).toBe(200)
      const byId = Object.fromEntries((data.variants as VariantPreview[]).map((v) => [v.variant_id, v]))

      const flash = byId[flashVariantId]
      expect(flash.currency_code).toBe("thb")
      expect(flash.original_price).toBeGreaterThan(0)
      // F (20%) เท่านั้น — N (10%, campaign ไม่มี config) และ campaign ที่หมดเวลาไม่นับ
      expect(flash.flash_price).toBeCloseTo(flash.original_price * 0.8, 2)
      expect(flash.campaign_id).toBe(activeCampaignId)

      const other = byId[otherVariantId]
      expect(other.original_price).toBeGreaterThan(0)
      expect(other.flash_price).toBeNull()
      expect(other.campaign_id).toBeNull()
    })

    it("rejects variant_ids without region_id", async () => {
      const error = await api
        .get(`/store/flash-sales/active?variant_ids[]=${flashVariantId}`, storeHeaders)
        .catch((e) => e)

      expect(error.response.status).toBe(400)
    })
  },
})
