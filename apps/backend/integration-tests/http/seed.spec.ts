import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEFAULT_REGION_STORE_POLICIES } from "../../src/lib/region-store-policies"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "seed-admin@example.com"
const ADMIN_PASSWORD = "seed-test-password"
const DIGITAL_PROVIDER_ID = "digital_digital"

// CORE-2: seed ร้าน Thailand (THB, VAT 7% รวมในราคา, Standard + Digital delivery, สินค้าตัวอย่าง, admin user)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

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
      // PAY-1: Stripe บัตร + PromptPay (spec 06)
      expect(region.payment_providers.map((p) => p.id)).toEqual(
        expect.arrayContaining(["pp_stripe_stripe", "pp_stripe-promptpay_stripe"])
      )

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
      expect(Object.keys(byName).sort()).toEqual(["Digital delivery", "Standard", "Standard return"])

      const thb = (o) => o.prices.find((p) => p.currency_code === "thb")?.amount
      expect(byName.Standard.price_type).toEqual("flat")
      expect(thb(byName.Standard)).toEqual(DEFAULT_REGION_STORE_POLICIES.shipping_rate)
      expect(thb(byName["Digital delivery"])).toEqual(0)
      expect(byName["Digital delivery"].shipping_profile.type).toEqual("digital")
      expect(byName.Standard.shipping_profile.type).toEqual("default")
      // EV-3 (ADR-006): Digital delivery ใช้ fulfillment provider `digital`
      expect(byName["Digital delivery"].provider_id).toEqual(DIGITAL_PROVIDER_ID)
      expect(byName.Standard.provider_id).toEqual("manual_manual")
    })

    // CORE-16: ลูกค้าคืนสินค้าด้วย option นี้ (store ระบุราคาเองไม่ได้) — ราคาตาม free_returns/shipping_rate ของ region
    it("creates return option Standard return (is_return, flat THB, manual, at the seeded location)", async () => {
      const { data } = await query().graph({
        entity: "shipping_option",
        fields: ["name", "price_type", "provider_id", "prices.*", "rules.*", "service_zone.fulfillment_set.location.id"],
        filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
      })
      expect(data).toHaveLength(1)
      const [option] = data
      expect(option).toMatchObject({ name: "Standard return", price_type: "flat", provider_id: "manual_manual" })
      const rule = (attribute: string) => option.rules?.find((r) => r?.attribute === attribute)?.value
      expect(rule("is_return")).toEqual("true")
      expect(rule("enabled_in_store")).toEqual("true")
      const expected = DEFAULT_REGION_STORE_POLICIES.free_returns ? 0 : DEFAULT_REGION_STORE_POLICIES.shipping_rate
      expect(option.prices?.find((p) => p?.currency_code === "thb")?.amount).toEqual(expected)
      expect(option.service_zone?.fulfillment_set?.location?.id).toEqual(expect.any(String))
    })

    it("adds Standard return to a store seeded before CORE-16, once", async () => {
      const fulfillment = getContainer().resolve(Modules.FULFILLMENT)
      const returnOptions = async () =>
        (
          await query().graph({
            entity: "shipping_option",
            fields: ["id"],
            filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
          })
        ).data
      // จำลอง DB ที่ seed ก่อน CORE-16: ยังไม่มี return option
      await fulfillment.deleteShippingOptions((await returnOptions()).map((o) => o.id))
      expect(await returnOptions()).toEqual([])

      await seedThailand({ container: getContainer(), args: [] })
      await seedThailand({ container: getContainer(), args: [] })

      expect(await returnOptions()).toHaveLength(1)
    })

    it("enables fulfillment provider digital at the seeded stock location (EV-3)", async () => {
      const { data: locations } = await api.get("/admin/stock-locations?fields=id", adminHeaders)
      const { data } = await api.get(
        `/admin/fulfillment-providers?stock_location_id=${locations.stock_locations[0].id}`,
        adminHeaders
      )
      expect(data.fulfillment_providers.map((p) => p.id).sort()).toEqual([
        DIGITAL_PROVIDER_ID,
        "manual_manual",
      ])
    })

    it("upgrades an already-seeded store: Digital delivery moves from manual to digital (EV-3)", async () => {
      const container = getContainer()
      const fulfillment = container.resolve(Modules.FULFILLMENT)
      const [option] = await fulfillment.listShippingOptions({ name: "Digital delivery" })
      const { data: locations } = await api.get("/admin/stock-locations?fields=id", adminHeaders)
      const locationId = locations.stock_locations[0].id
      // จำลอง DB ที่ seed ก่อน EV-3: Digital delivery ผูก manual_manual และ location ยังไม่เปิด provider digital
      await fulfillment.updateShippingOptions(option.id, { provider_id: "manual_manual" })
      await container.resolve(ContainerRegistrationKeys.LINK).dismiss({
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: DIGITAL_PROVIDER_ID },
      })

      await seedThailand({ container, args: [] })
      await seedThailand({ container, args: [] })

      const options = await fulfillment.listShippingOptions({ name: "Digital delivery" })
      expect(options).toHaveLength(1)
      expect(options[0]).toMatchObject({ id: option.id, provider_id: DIGITAL_PROVIDER_ID })
      const { data } = await api.get(
        `/admin/fulfillment-providers?stock_location_id=${locationId}`,
        adminHeaders
      )
      expect(data.fulfillment_providers.map((p) => p.id)).toContain(DIGITAL_PROVIDER_ID)
    })

    // EV-8 AC-14 (spec 02 กฎข้อ 8): หา option ด้วย type.code ไม่ใช่ชื่อ (ชื่อแก้ได้ใน admin)
    it("AC-14 upgrades Digital delivery renamed in admin, found by type.code, without creating a new option", async () => {
      const fulfillment = getContainer().resolve(Modules.FULFILLMENT)
      const [option] = await fulfillment.listShippingOptions({ name: "Digital delivery" })
      const before = await fulfillment.listShippingOptions({})
      await fulfillment.updateShippingOptions(option.id, {
        name: "E-mail delivery",
        provider_id: "manual_manual",
      })

      try {
        await seedThailand({ container: getContainer(), args: [] })

        const after = await fulfillment.listShippingOptions({})
        expect(after).toHaveLength(before.length)
        const renamed = await fulfillment.retrieveShippingOption(option.id)
        expect(renamed).toMatchObject({ name: "E-mail delivery", provider_id: DIGITAL_PROVIDER_ID })
      } finally {
        await fulfillment.updateShippingOptions(option.id, { name: "Digital delivery" })
      }
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
