import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { DEFAULT_REGION_STORE_POLICIES } from "../../src/lib/region-store-policies"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

// CORE-16 (owner 2026-10-26): POST /store/returns ของ Medusa 2.22.1 รับ `return_shipping.price`, `receive_now` และ
// `location_id` จาก body → store ระบุเองไม่ได้ (400) ราคาส่งคืนมาจาก return shipping option ใน seed และ admin เป็นผู้รับของ
type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: { type?: string } } }

const responseOf = (request: Promise<{ status: number; data: unknown }>) =>
  request.then(
    ({ status, data }) => ({ status, data: data as { type?: string } }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let owner: Headers
    let returnOptionId: string
    let locationId: string
    let order: { id: string; itemId: string }

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core16-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core16-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      const a = await registerCustomer(api, pk, "core16-a@example.com", "core16-a-password")
      owner = storeHeadersFor(pk, a.token)

      const { data: regions } = await query().graph({ entity: "region", fields: ["id"] })
      const { data: products } = await query().graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      const { data: standard } = await query().graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      const { data: returnOptions } = await query().graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
      })
      returnOptionId = returnOptions[0]?.id
      const { data: locations } = await query().graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id

      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regions[0].id,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit Rd",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: products[0].variants[0].id, quantity: 2 }],
        },
        owner
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard[0].id }, owner)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, owner)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        owner
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, owner)
      order = { id: completed.order.id, itemId: completed.order.items[0].id }
      await createOrderFulfillmentWorkflow(container).run({
        input: { order_id: order.id, items: [{ id: order.itemId, quantity: 2 }] },
      })
    })

    const returnsOf = async () => {
      const { data } = await query().graph({
        entity: "return",
        fields: ["id", "status", "received_at", "location_id", "shipping_methods.amount", "shipping_methods.shipping_option_id"],
        filters: { order_id: order.id },
      })
      return data
    }

    const body = (extra: Record<string, unknown> = {}, shipping: Record<string, unknown> = {}) => ({
      order_id: order.id,
      items: [{ id: order.itemId, quantity: 1 }],
      return_shipping: { option_id: returnOptionId, ...shipping },
      ...extra,
    })

    it("seed has a return shipping option (is_return) that customers can use", () => {
      expect(returnOptionId).toEqual(expect.any(String))
    })

    it.each([
      ["return_shipping.price", () => body({}, { price: 0 })],
      ["receive_now", () => body({ receive_now: true })],
      ["receive_now (false)", () => body({ receive_now: false })],
      ["location_id", () => body({ location_id: "sloc_attacker" })],
    ])("owner sending %s → 400 invalid_data and no return is created", async (_field, payload) => {
      const { status, data } = await responseOf(api.post("/store/returns", payload(), owner))
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(await returnsOf()).toEqual([])
    })

    it("owner creates a return with the seeded option: price from the option, not received, location from the option", async () => {
      const { status, data } = await api.post("/store/returns", body(), owner)
      expect(status).toEqual(200)

      const returns = await returnsOf()
      expect(returns.map((r) => r.id)).toEqual([data.return.id])
      const [created] = returns
      expect(created.status).toEqual("requested")
      expect(created.received_at).toBeNull()
      const expectedPrice = DEFAULT_REGION_STORE_POLICIES.free_returns ? 0 : DEFAULT_REGION_STORE_POLICIES.shipping_rate
      expect(created.shipping_methods?.map((m) => [m?.shipping_option_id, Number(m?.amount)])).toEqual([[returnOptionId, expectedPrice]])

      // fulfillment ของ return ไปที่ stock location ของ option (Bangkok Warehouse) ไม่ใช่ค่าจาก store
      const { data: links } = await query().graph({
        entity: "return",
        fields: ["fulfillments.location_id"],
        filters: { id: data.return.id },
      })
      expect(links[0].fulfillments?.map((f) => f?.location_id)).toEqual([locationId])
    })
  },
})
