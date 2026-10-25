import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEFAULT_REGION_STORE_POLICIES } from "../../src/lib/region-store-policies"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "seed-admin@example.com"
const ADMIN_PASSWORD = "seed-test-password"

// CORE-2: seed ร้าน Thailand (THB, VAT 7% รวมในราคา, Standard + Digital delivery, สินค้าตัวอย่าง, admin user)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container: getContainer(), args: [] })
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${data.token}` } }
    })

    it("creates region Thailand in THB, tax-inclusive, with store policy metadata", async () => {
      const { data } = await api.get(
        "/admin/regions?fields=id,name,currency_code,automatic_taxes,metadata,*countries,*payment_providers",
        adminHeaders
      )
      expect(data.regions).toHaveLength(1)
      const region = data.regions[0]
      expect(region).toMatchObject({
        name: "Thailand",
        currency_code: "thb",
        automatic_taxes: true,
        metadata: expect.objectContaining(DEFAULT_REGION_STORE_POLICIES),
      })
      expect(region.countries.map((c) => c.iso_2)).toEqual(["th"])
      expect(region.payment_providers.map((p) => p.id)).toContain("pp_system_default")

      const { data: prefs } = await api.get(
        `/admin/price-preferences?attribute=region_id&value=${region.id}`,
        adminHeaders
      )
      expect(prefs.price_preferences).toEqual([
        expect.objectContaining({ is_tax_inclusive: true }),
      ])
    })

    it("sets store default currency to THB (tax-inclusive)", async () => {
      const { data } = await api.get("/admin/stores", adminHeaders)
      expect(data.stores[0].supported_currencies).toEqual([
        expect.objectContaining({ currency_code: "thb", is_default: true }),
      ])

      const { data: prefs } = await api.get(
        "/admin/price-preferences?attribute=currency_code&value=thb",
        adminHeaders
      )
      expect(prefs.price_preferences).toEqual([
        expect.objectContaining({ is_tax_inclusive: true }),
      ])
    })

    it("creates tax region th with VAT 7%", async () => {
      const { data } = await api.get(
        "/admin/tax-regions?country_code=th&fields=*tax_rates",
        adminHeaders
      )
      expect(data.tax_regions).toHaveLength(1)
      expect(data.tax_regions[0].tax_rates).toEqual([
        expect.objectContaining({ rate: 7, code: "VAT", is_default: true }),
      ])
    })

    it("creates shipping options Standard (flat THB) and Digital delivery (free)", async () => {
      const { data } = await api.get(
        "/admin/shipping-options?fields=name,price_type,provider_id,*prices,*shipping_profile",
        adminHeaders
      )
      const byName = Object.fromEntries(data.shipping_options.map((o) => [o.name, o]))
      expect(Object.keys(byName).sort()).toEqual(["Digital delivery", "Standard"])

      const thb = (o) => o.prices.find((p) => p.currency_code === "thb")?.amount
      expect(byName.Standard.price_type).toEqual("flat")
      expect(thb(byName.Standard)).toEqual(DEFAULT_REGION_STORE_POLICIES.shipping_rate)
      expect(thb(byName["Digital delivery"])).toEqual(0)
      expect(byName["Digital delivery"].shipping_profile.type).toEqual("digital")
      expect(byName.Standard.shipping_profile.type).toEqual("default")
    })

    it("exposes sample products in THB (tax-inclusive) to the storefront publishable key", async () => {
      const token = await getPublishableKey(getContainer())
      expect(token).toMatch(/^pk_/)

      const { data: regions } = await api.get("/store/regions", {
        headers: { "x-publishable-api-key": token },
      })
      const { data } = await api.get(
        `/store/products?region_id=${regions.regions[0].id}&fields=*variants.calculated_price`,
        { headers: { "x-publishable-api-key": token } }
      )
      expect(data.products.length).toBeGreaterThanOrEqual(2)
      const price = data.products[0].variants[0].calculated_price
      expect(price).toMatchObject({
        currency_code: "thb",
        is_calculated_price_tax_inclusive: true,
      })
    })

    it("stocks every sample variant at the seeded location", async () => {
      const { data } = await api.get(
        "/admin/inventory-items?fields=id,*location_levels",
        adminHeaders
      )
      expect(data.inventory_items.length).toBeGreaterThan(0)
      for (const item of data.inventory_items) {
        expect(item.location_levels).toEqual([
          expect.objectContaining({ stocked_quantity: expect.any(Number) }),
        ])
        expect(item.location_levels[0].stocked_quantity).toBeGreaterThan(0)
      }
    })

    it("is idempotent: running seed again does not duplicate data", async () => {
      const before = await api.get("/admin/products?fields=id", adminHeaders)
      await seedThailand({ container: getContainer(), args: [] })

      const { data: regions } = await api.get("/admin/regions", adminHeaders)
      const after = await api.get("/admin/products?fields=id", adminHeaders)
      expect(regions.regions).toHaveLength(1)
      expect(after.data.count).toEqual(before.data.count)
    })
  },
})
