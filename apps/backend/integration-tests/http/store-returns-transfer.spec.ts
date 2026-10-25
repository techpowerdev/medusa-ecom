import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

// CORE-13 (spec 01 กฎ 24, ADR-013, owner Q-F3, AC-39/AC-40): POST /store/returns ต้องล็อกอินและเป็นเจ้าของ order;
// order transfer (request/accept/decline/cancel) ปิดทั้งชุด → 404 เสมอ (ก่อน authenticate ของ core)
type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: unknown } }

const statusOf = (request: Promise<{ status: number }>): Promise<number | undefined> =>
  request.then(
    ({ status }) => status,
    (e: HttpError) => e.response?.status
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let customerA: { id: string; config: Headers }
    let customerB: { id: string; config: Headers }
    let guestHeaders: Headers
    let standardOptionId: string
    let order: { id: string; itemId: string }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core13-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core13-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      guestHeaders = storeHeadersFor(pk)

      const a = await registerCustomer(api, pk, "core13-a@example.com", "core13-a-password")
      const b = await registerCustomer(api, pk, "core13-b@example.com", "core13-b-password")
      customerA = { id: a.customerId, config: storeHeadersFor(pk, a.token) }
      customerB = { id: b.customerId, config: storeHeadersFor(pk, b.token) }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      standardOptionId = options[0].id

      // order OA ของ A ผ่าน checkout ของ Medusa (pp_system_default)
      const config = customerA.config
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
        config
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, config)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, config)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        config
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, config)
      expect(completed.type).toEqual("order")
      order = { id: completed.order.id, itemId: completed.order.items[0].id }
      // Medusa คืนได้เฉพาะ item ที่ fulfill แล้ว — fulfill ผ่าน workflow ของ Medusa (เหมือน admin กด fulfill)
      await createOrderFulfillmentWorkflow(container).run({
        input: { order_id: order.id, items: [{ id: order.itemId, quantity: 2 }] },
      })
    })

    const returnsOf = async (orderId: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "return", fields: ["id", "order_id"], filters: { order_id: orderId } })
      return data
    }

    describe("AC-39: POST /store/returns", () => {
      const body = () => ({
        order_id: order.id,
        items: [{ id: order.itemId, quantity: 1 }],
        // ค่าส่งคืนระบุเอง: "Standard" เป็น flat ของ manual provider
        return_shipping: { option_id: standardOptionId, price: 0 },
      })

      it("401 without token, 404 for customer B (no return created), 200 for owner A", async () => {
        expect(await statusOf(api.post("/store/returns", body(), guestHeaders))).toEqual(401)
        expect(await statusOf(api.post("/store/returns", body(), customerB.config))).toEqual(404)
        expect(await returnsOf(order.id)).toEqual([])

        const { status, data } = await api.post("/store/returns", body(), customerA.config)
        expect(status).toEqual(200)
        expect(data.return.order_id).toEqual(order.id)
        expect((await returnsOf(order.id)).map((r) => r.id)).toEqual([data.return.id])
      })

      it("an order id that does not exist → 404; no order_id → rejected (not 200)", async () => {
        expect(
          await statusOf(api.post("/store/returns", { ...body(), order_id: "order_doesnotexist" }, customerA.config))
        ).toEqual(404)
        const { order_id: _omit, ...withoutOrder } = body()
        expect(await statusOf(api.post("/store/returns", withoutOrder, customerA.config))).not.toEqual(200)
      })
    })

    describe("AC-40: order transfer is disabled", () => {
      it("request/accept/decline/cancel → 404 without token, as B and as A; no transfer change; owner stays A", async () => {
        // body ถูกต้องตาม validator ของ Medusa (StoreRequestOrderTransfer / StoreAcceptOrderTransfer / StoreDeclineOrderTransferRequest)
        const calls: Record<string, unknown> = {
          request: { description: "core13" },
          accept: { token: "core13-token" },
          decline: { token: "core13-token" },
          cancel: {},
        }
        const callers: Record<string, Headers> = { guest: guestHeaders, B: customerB.config, A: customerA.config }

        for (const [who, headers] of Object.entries(callers)) {
          for (const [action, payload] of Object.entries(calls)) {
            const status = await statusOf(api.post(`/store/orders/${order.id}/transfer/${action}`, payload, headers))
            expect({ who, action, status }).toEqual({ who, action, status: 404 })
          }
        }

        const orderModule = getContainer().resolve(Modules.ORDER)
        const changes = await orderModule.listOrderChanges({ order_id: order.id }, { select: ["id", "change_type"] })
        expect(changes.filter((c) => c.change_type === "transfer")).toEqual([])
        const [after] = await orderModule.listOrders({ id: order.id }, { select: ["id", "customer_id"] })
        expect(after.customer_id).toEqual(customerA.id)
      })
    })
  },
})
