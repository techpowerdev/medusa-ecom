import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// CORE-10 (spec 01 กฎข้อ 17, AC-30, AC-31): seed เช็กการมีอยู่ทีละ resource — region ที่มีอยู่แล้ว
// ไม่ทำให้ข้ามการสร้าง resource อื่น และไม่มี SEED_ADMIN_PASSWORD = ข้ามการสร้าง admin
const SHIPPING_ADDRESS = {
  first_name: "สมชาย",
  last_name: "ใจดี",
  address_1: "1 ถนนสุขุมวิท",
  city: "กรุงเทพฯ",
  postal_code: "10110",
  country_code: "th",
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const all = async (entity: string, filters?: Record<string, unknown>) =>
      (await query().graph({ entity, fields: ["id"], filters })).data

    let regionId: string

    beforeAll(async () => {
      // DB ที่มีเพียง region "Thailand" (เช่น admin สร้างเองก่อนรัน seed)
      const { result } = await createRegionsWorkflow(getContainer()).run({
        input: {
          regions: [
            {
              name: "Thailand",
              currency_code: "thb",
              countries: ["th"],
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      })
      regionId = result[0].id

      process.env.SEED_ADMIN_EMAIL = "core10-admin@example.com"
      delete process.env.SEED_ADMIN_PASSWORD
      await seedThailand({ container: getContainer(), args: [] })
    })

    it("AC-31 skips the admin user when SEED_ADMIN_PASSWORD is not set", async () => {
      expect(await all("user")).toEqual([])
    })

    it("AC-30 keeps the existing region and creates every other resource", async () => {
      const regions = await all("region")
      expect(regions.map((r) => r.id)).toEqual([regionId])

      expect(await all("tax_region", { country_code: "th" })).toHaveLength(1)
      expect(await all("stock_location", { name: "Bangkok Warehouse" })).toHaveLength(1)
      expect(await all("fulfillment_set", { name: "Thailand delivery" })).toHaveLength(1)
      for (const code of ["standard", "digital-delivery", RETURN_OPTION_TYPE_CODE]) {
        expect(await all("shipping_option", { type: { code } })).toHaveLength(1)
      }
      expect(await getPublishableKey(getContainer())).toMatch(/^pk_/)
      expect(await all("product_category")).toHaveLength(2)

      const { data: products } = await query().graph({
        entity: "product",
        fields: ["handle", "variants.inventory_items.inventory.location_levels.id"],
      })
      expect(products.map((p) => p.handle).sort()).toEqual(["sweatshirt", "t-shirt"])
      const levels = products.flatMap((p) =>
        (p.variants ?? []).flatMap((v) =>
          (v?.inventory_items ?? []).flatMap((i) => i?.inventory?.location_levels ?? [])
        )
      )
      expect(levels).toHaveLength(5)
    })

    it("AC-30 a customer can check out (AC-1 flow) on the completed store", async () => {
      const pk = await getPublishableKey(getContainer())
      const { token } = await registerCustomer(api, pk, "core10-buyer@example.com", "core10-buyer-password")
      const headers = storeHeadersFor(pk, token)

      const { data: products } = await api.get(
        `/store/products?handle=t-shirt&region_id=${regionId}&fields=*variants`,
        headers
      )
      const variantId = products.products[0].variants[0].id
      const { data: created } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }], shipping_address: SHIPPING_ADDRESS },
        headers
      )
      const cartId = created.cart.id

      const { data: options } = await api.get(`/store/shipping-options?cart_id=${cartId}`, headers)
      const standard = options.shipping_options.find((o: { name: string }) => o.name === "Standard")
      expect(standard).toBeDefined()
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard.id }, headers)

      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, headers)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        headers
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, headers)
      expect(completed.type).toEqual("order")
      expect(completed.order.currency_code).toEqual("thb")
    })
  },
})
