import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DEFAULT_REGION_STORE_POLICIES } from "../../src/lib/region-store-policies"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { shipOrderItems } from "../helpers/ship-order"

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
    let standardOptionId: string
    let locationId: string
    let regionId: string
    let variantId: string
    type Order = { id: string; itemId: string }

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
      regionId = regions[0].id
      const { data: products } = await query().graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      variantId = products[0].variants[0].id
      const { data: standard } = await query().graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      standardOptionId = standard[0].id
      const { data: returnOptions } = await query().graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: RETURN_OPTION_TYPE_CODE } },
      })
      returnOptionId = returnOptions[0]?.id
      const { data: locations } = await query().graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id
    })

    // แต่ละ case ใช้ order ของตัวเอง (2 ชิ้น fulfill + ship แล้ว) — case หนึ่งล้มไม่ทำให้ case อื่นล้มตาม
    const placeOrder = async (): Promise<Order> => {
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit Rd",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: variantId, quantity: 2 }],
        },
        owner
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, owner)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, owner)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        owner
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, owner)
      const order = { id: completed.order.id, itemId: completed.order.items[0].id }
      await shipOrderItems(getContainer(), order.id, [{ id: order.itemId, quantity: 2 }])
      return order
    }

    const returnsOf = async (order: Order) => {
      const { data } = await query().graph({
        entity: "return",
        fields: ["id", "status", "received_at", "location_id", "shipping_methods.amount", "shipping_methods.shipping_option_id"],
        filters: { order_id: order.id },
      })
      return data
    }

    const body = (order: Order, quantity = 1) => ({
      order_id: order.id,
      items: [{ id: order.itemId, quantity }],
      return_shipping: { option_id: returnOptionId } as Record<string, unknown>,
    })

    it("seed has a return shipping option (is_return) that customers can use", () => {
      expect(returnOptionId).toEqual(expect.any(String))
    })

    it.each([
      ["return_shipping.price", (o: Order) => {
        const b = body(o)
        return { ...b, return_shipping: { ...b.return_shipping, price: 0 } }
      }],
      // คืนครบ 2 ชิ้น: ถ้าไปถึง workflow ของ Medusa จะได้ 200 และ return ถูกบันทึกว่ารับแล้ว
      ["receive_now (true, full quantity)", (o: Order) => ({ ...body(o, 2), receive_now: true })],
      ["receive_now (false)", (o: Order) => ({ ...body(o), receive_now: false })],
      ["location_id", (o: Order) => ({ ...body(o), location_id: locationId })],
    ])("owner sending %s → 400 invalid_data and no return is created", async (_field, payload) => {
      const order = await placeOrder()
      const { status, data } = await responseOf(api.post("/store/returns", payload(order), owner))
      expect({ status, type: data?.type }).toEqual({ status: 400, type: "invalid_data" })
      expect(await returnsOf(order)).toEqual([])
    })

    it("owner creates a return with the seeded option: price from the option, not received, location from the option", async () => {
      const order = await placeOrder()
      const { status, data } = await api.post("/store/returns", body(order), owner)
      expect(status).toEqual(200)

      const returns = await returnsOf(order)
      expect(returns.map((r) => r.id)).toEqual([data.return.id])
      const [created] = returns
      expect(created.status).toEqual("requested")
      expect(created.received_at).toBeNull()
      const expectedPrice = DEFAULT_REGION_STORE_POLICIES.free_returns ? 0 : DEFAULT_REGION_STORE_POLICIES.shipping_rate
      // Query คืน shipping method ของ return เป็น OrderShippingMethod (type ที่ generate ประกาศเป็น OrderShipping)
      const methods = created.shipping_methods as unknown as { shipping_option_id: string; amount: number }[]
      expect(methods.map((m) => [m.shipping_option_id, Number(m.amount)])).toEqual([[returnOptionId, expectedPrice]])

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
