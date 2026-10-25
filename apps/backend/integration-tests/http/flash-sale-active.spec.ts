import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, decorateCartTotals } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { exclusiveAutomaticRule } from "../../src/lib/promotion-exclusivity"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import type FlashSaleModuleService from "../../src/modules/flash_sale/service"

jest.setTimeout(300 * 1000)

// FS-4: spec 03 "API" + AC-4 (ส่วน API) — GET /store/flash-sales/active
// FS-7: AC-13 (a)–(d) — sold_out / remaining_units อิงหน่วยใน FlashSaleConfig (กฎข้อ 4)
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
  sold_out: boolean
  remaining_units: number | null
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
    let customerHeaders: { headers: Record<string, string> } // CORE-6: สร้าง cart ได้เฉพาะ customer ที่ล็อกอิน
    let regionId: string
    let flashVariantId: string // t-shirt L → F (target ตาม product)
    let otherVariantId: string // sweatshirt M → N เท่านั้น
    let fixedVariantId: string // t-shirt S → F + flash fixed 100 THB (is_tax_inclusive=false)
    let inclusiveVariantId: string // t-shirt M → F + flash 15% (is_tax_inclusive=true)
    let activeCampaignId: string
    let expiredCampaignId: string
    let plainCampaignId: string
    let plainPromotionIds: string[]

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "fs4-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "fs4-test-password"
      await seedThailand({ container, args: [] })

      const token = await getPublishableKey(container)
      storeHeaders = { headers: { "x-publishable-api-key": token! } }
      const customer = await registerCustomer(api, token!, "fs4-customer@example.com", "fs4-customer-password")
      customerHeaders = storeHeadersFor(token!, customer.token)

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
      fixedVariantId = tshirt.variants.find((v) => v.title === "S")!.id
      inclusiveVariantId = tshirt.variants.find((v) => v.title === "M")!.id
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
        {
          code: "FS4FIXED100",
          type: "standard",
          status: "active",
          is_automatic: true,
          is_tax_inclusive: false,
          campaign_id: activeCampaignId,
          rules: [exclusiveAutomaticRule()],
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "each",
            max_quantity: 1,
            value: 100,
            currency_code: "thb",
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [fixedVariantId] }],
          },
        },
        {
          code: "FS4INCL15",
          type: "standard",
          status: "active",
          is_automatic: true,
          is_tax_inclusive: true,
          campaign_id: activeCampaignId,
          rules: [exclusiveAutomaticRule()],
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 1,
            value: 15,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [inclusiveVariantId] }],
          },
        },
      ])
      plainPromotionIds = (
        await promotionModule.listPromotions({ code: ["FS4AUTO10", "FS4AUTO10B"] }, { select: ["id"] })
      ).map((p) => p.id)

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
        sold_out: false,
        remaining_units: null, // ยังไม่ตั้ง total_cap
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

    const preview = async (variantId: string, headers = storeHeaders) => {
      const { data } = await api.get(
        `/store/flash-sales/active?region_id=${regionId}&variant_ids[]=${variantId}`,
        headers
      )
      return data as { flash_sales: FlashSale[]; variants: VariantPreview[] }
    }

    // ยอด line ของ cart จริง (ไม่มี code) — ปิด N ชั่วคราวให้ cart มีแต่ส่วนลด flash เทียบกับ preview ได้ตรง
    const realCartLine = async (variantId: string) => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      await promotionModule.updatePromotions(plainPromotionIds.map((id) => ({ id, status: "inactive" as const })))
      try {
        const {
          data: { cart },
        } = await api.post(
          "/store/carts",
          {
            region_id: regionId,
            shipping_address: { country_code: "th", city: "Bangkok", postal_code: "10110" },
            items: [{ variant_id: variantId, quantity: 1 }],
          },
          customerHeaders
        )
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "cart",
          fields: ["currency_code", "items.*", "items.tax_lines.*", "items.adjustments.*"],
          filters: { id: cart.id },
        })
        // คำนวณยอด line แบบเดียวกับ store cart API ของ Medusa
        const totals = decorateCartTotals(data[0] as unknown as Parameters<typeof decorateCartTotals>[0]) as unknown as {
          items: { variant_id: string; total: unknown; adjustments?: { code: string }[] }[]
        }
        const line = totals.items.find((i) => i.variant_id === variantId)!
        return { total: Number(line.total), codes: (line.adjustments ?? []).map((a) => a.code).sort() }
      } finally {
        await promotionModule.updatePromotions(plainPromotionIds.map((id) => ({ id, status: "active" as const })))
      }
    }

    it("matches the real cart line total on tax-inclusive THB (fixed 100 excl. VAT = 107 off)", async () => {
      const [fixed] = (await preview(fixedVariantId)).variants
      const line = await realCartLine(fixedVariantId)

      expect(line.codes).toEqual(["FS4FIXED100", "FS4FLASH20"])
      expect(fixed.flash_price).toBeCloseTo(line.total, 2)
      // ไม่ใช่ราคา − 20% − 100 แบบไม่คิด VAT
      expect(Math.abs(fixed.flash_price! - (fixed.original_price * 0.8 - 100))).toBeGreaterThan(1)
    })

    it("matches the real cart line total for a tax-inclusive promotion (no double VAT)", async () => {
      const [inclusive] = (await preview(inclusiveVariantId)).variants
      const line = await realCartLine(inclusiveVariantId)

      expect(line.codes).toEqual(["FS4FLASH20", "FS4INCL15"])
      expect(inclusive.flash_price).toBeCloseTo(line.total, 2)
    })

    it("ignores order-level flash promotions in flash_price (only target_type items)", async () => {
      const promotionModule = container.resolve(Modules.PROMOTION)
      const [orderPromotion] = await promotionModule.createPromotions([
        {
          code: "FS4ORDER50",
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: activeCampaignId,
          rules: [exclusiveAutomaticRule()],
          application_method: {
            type: "fixed",
            target_type: "order",
            allocation: "across",
            value: 50,
            currency_code: "thb",
          },
        },
      ])
      try {
        const [flash] = (await preview(flashVariantId)).variants
        expect(flash.flash_price).toBeCloseTo(flash.original_price * 0.8, 2)
      } finally {
        await promotionModule.updatePromotions([{ id: orderPromotion.id, status: "inactive" }])
      }
    })

    it("only prices variants sold in the publishable key's sales channels", async () => {
      const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
      const apiKeyModule = container.resolve(Modules.API_KEY)
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      const channel = await salesChannelModule.createSalesChannels({ name: "FS-4 empty channel" })
      const key = await apiKeyModule.createApiKeys({ title: "FS-4 other key", type: "publishable", created_by: "" })
      await link.create({
        [Modules.API_KEY]: { publishable_key_id: key.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: channel.id },
      })

      const data = await preview(flashVariantId, { headers: { "x-publishable-api-key": key.token } })
      expect(data.flash_sales.map((f) => f.id)).toEqual([activeCampaignId])
      expect(data.variants).toEqual([])
    })

    describe("AC-13: sold_out / remaining_units from FlashSaleConfig units (FS-7)", () => {
      const setConfig = async (data: { total_cap: number | null; units_sold: number; show_remaining: boolean }) => {
        const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
        const [config] = await flashSale.listFlashSaleConfigs({ campaign_id: activeCampaignId }, { select: ["id"] })
        await flashSale.updateFlashSaleConfigs({ id: config.id, ...data })
      }
      const activeSale = async () => {
        const { status, data } = await api.get("/store/flash-sales/active", storeHeaders)
        expect(status).toBe(200)
        return (data.flash_sales as FlashSale[]).find((f) => f.id === activeCampaignId)!
      }

      afterEach(async () => {
        await setConfig({ total_cap: null, units_sold: 0, show_remaining: true })
        const promotionModule = container.resolve(Modules.PROMOTION)
        await promotionModule.updateCampaigns({ id: activeCampaignId, budget: { used: 0 } })
      })

      it("(a) counts units, not orders: units_sold=7 vs budget usage 5 → remaining_units=3, no remaining_usage", async () => {
        // order qty 3 + 4 order qty 1 → units_sold 7 แต่ campaign budget ของ Medusa นับ 5 (ต่อ order)
        const promotionModule = container.resolve(Modules.PROMOTION)
        await promotionModule.updateCampaigns({ id: activeCampaignId, budget: { used: 5 } })
        await setConfig({ total_cap: 10, units_sold: 7, show_remaining: true })

        const sale = await activeSale()
        expect(sale.remaining_units).toBe(3)
        expect(sale.sold_out).toBe(false)
        expect(sale).not.toHaveProperty("remaining_usage")
      })

      it("(b) units_sold reaches total_cap → remaining_units=0, sold_out=true", async () => {
        await setConfig({ total_cap: 10, units_sold: 10, show_remaining: true })

        expect(await activeSale()).toMatchObject({ remaining_units: 0, sold_out: true })
      })

      it("(c) total_cap lowered below units_sold → remaining_units clamps at 0, sold_out=true", async () => {
        await setConfig({ total_cap: 5, units_sold: 10, show_remaining: true })

        expect(await activeSale()).toMatchObject({ remaining_units: 0, sold_out: true })
      })

      it("(d) show_remaining=false hides remaining_units but keeps sold_out; no total_cap → never sold out", async () => {
        await setConfig({ total_cap: 10, units_sold: 10, show_remaining: false })
        expect(await activeSale()).toMatchObject({ remaining_units: null, sold_out: true })

        await setConfig({ total_cap: null, units_sold: 10, show_remaining: true })
        expect(await activeSale()).toMatchObject({ remaining_units: null, sold_out: false })
      })
    })

    it("rejects variant_ids without region_id", async () => {
      const error = await api
        .get(`/store/flash-sales/active?variant_ids[]=${flashVariantId}`, storeHeaders)
        .catch((e) => e)

      expect(error.response.status).toBe(400)
    })

    it("rejects more than 24 variant_ids (bounded computeActions per request)", async () => {
      const ids = Array.from({ length: 25 }, (_, i) => `variant_${i}`)
      const qs = ids.map((id) => `variant_ids[]=${id}`).join("&")
      const error = await api
        .get(`/store/flash-sales/active?region_id=${regionId}&${qs}`, storeHeaders)
        .catch((e) => e)

      expect(error.response.status).toBe(400)
    })
  },
})
