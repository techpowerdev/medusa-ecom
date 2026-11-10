import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

// CORE-12 (spec 01 กฎ 22, ADR-013, AC-34..AC-38): cart / payment collection / shipping options / order
// ต้องเป็นของ customer ที่ล็อกอิน — ไม่ใช่เจ้าของ, ไม่พบ หรือ owner เป็น null → 404; ไม่มี token → 401
const PROMO_CODE = "CORE12OFF"
const SHIPPING_ADDRESS = {
  first_name: "Somchai",
  last_name: "Jaidee",
  address_1: "1 Sukhumvit Rd",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

type Headers = { headers: Record<string, string> }
type HttpError = { response?: { status: number; data?: { message?: string } } }
type Result = { status?: number; data?: any }

const call = (request: Promise<{ status: number; data: any }>): Promise<Result> =>
  request.then(
    ({ status, data }) => ({ status, data }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let variantIds: string[]
    let standardOptionId: string
    let customerA: { id: string; config: Headers }
    let customerB: { id: string; config: Headers }
    let guestHeaders: Headers

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core12-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core12-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      guestHeaders = storeHeadersFor(pk)

      const a = await registerCustomer(api, pk, "core12-a@example.com", "core12-a-password")
      const b = await registerCustomer(api, pk, "core12-b@example.com", "core12-b-password")
      customerA = { id: a.customerId, config: storeHeadersFor(pk, a.token) }
      customerB = { id: b.customerId, config: storeHeadersFor(pk, b.token) }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      variantIds = products[0].variants.map((v) => v.id)
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      standardOptionId = options[0].id

      await container.resolve(Modules.PROMOTION).createPromotions([
        {
          code: PROMO_CODE,
          type: "standard",
          status: "active",
          is_automatic: false,
          application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10 },
        },
      ])
    })

    // cart ของ A พร้อม item, ที่อยู่, ค่าส่ง, promotion และ payment collection + session (pp_system_default)
    const prepareCartOfA = async () => {
      const config = customerA.config
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          shipping_address: SHIPPING_ADDRESS,
          items: [{ variant_id: variantIds[0], quantity: 1 }],
        },
        config
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/promotions`, { promo_codes: [PROMO_CODE] }, config)
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, config)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, config)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        config
      )
      return { cartId, lineId: data.cart.items[0].id as string, paymentCollectionId: pc.payment_collection.id as string }
    }

    // สถานะที่ AC-34/35 ต้องไม่เปลี่ยน
    const snapshot = async (cartId: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "cart",
        fields: [
          "email",
          "customer_id",
          "completed_at",
          "metadata",
          "items.variant_id",
          "items.quantity",
          "promotions.code",
          "shipping_methods.shipping_option_id",
          "payment_collection.payment_sessions.id",
        ],
        filters: { id: cartId },
      })
      const cart = data[0] as any
      return {
        email: cart.email,
        customer_id: cart.customer_id,
        completed_at: cart.completed_at,
        metadata: cart.metadata,
        items: cart.items.map((i) => [i.variant_id, i.quantity]).sort(),
        promotions: cart.promotions.map((p) => p.code).sort(),
        shipping_methods: cart.shipping_methods.map((m) => m.shipping_option_id),
        payment_sessions: cart.payment_collection.payment_sessions.map((s) => s.id).sort(),
      }
    }

    // ชุด route ของ AC-34 (ทุกตัวอ้าง cart ด้วย path)
    const cartRoutes = (cartId: string, lineId: string, headers: Headers) => ({
      "GET /store/carts/:id": () => api.get(`/store/carts/${cartId}`, headers),
      "POST /store/carts/:id": () => api.post(`/store/carts/${cartId}`, { email: "intruder@example.com" }, headers),
      "POST /store/carts/:id/line-items": () =>
        api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantIds[1], quantity: 1 }, headers),
      "POST /store/carts/:id/line-items/:line_id": () =>
        api.post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 5 }, headers),
      "DELETE /store/carts/:id/line-items/:line_id": () => api.delete(`/store/carts/${cartId}/line-items/${lineId}`, headers),
      "POST /store/carts/:id/promotions": () =>
        api.post(`/store/carts/${cartId}/promotions`, { promo_codes: [PROMO_CODE] }, headers),
      "DELETE /store/carts/:id/promotions": () =>
        api.delete(`/store/carts/${cartId}/promotions`, { ...headers, data: { promo_codes: [PROMO_CODE] } }),
      "POST /store/carts/:id/shipping-methods": () =>
        api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, headers),
      "POST /store/carts/:id/taxes": () => api.post(`/store/carts/${cartId}/taxes`, {}, headers),
      "POST /store/carts/:id/complete": () => api.post(`/store/carts/${cartId}/complete`, {}, headers),
      "POST /store/carts/:id/customer": () => api.post(`/store/carts/${cartId}/customer`, {}, headers),
    })

    describe("AC-34: cart routes", () => {
      it("customer B gets 404 on every cart route of A's cart and the cart does not change", async () => {
        const { cartId, lineId } = await prepareCartOfA()
        const before = await snapshot(cartId)

        const routes = cartRoutes(cartId, lineId, customerB.config)
        for (const [name, request] of Object.entries(routes)) {
          const res = await call(request())
          expect({ name, status: res.status }).toEqual({ name, status: 404 })
          // ไม่บอกว่า cart มีอยู่จริง (ข้อความเดียวกับ cart ที่ไม่มี)
          expect(JSON.stringify(res.data)).not.toContain("core12-a@example.com")
        }

        expect(await snapshot(cartId)).toEqual(before)
        expect(before.customer_id).toEqual(customerA.id)
      })

      it("customer A (owner) can still use the same routes", async () => {
        const { cartId, lineId } = await prepareCartOfA()
        const config = customerA.config
        const ok = async (request: Promise<{ status: number; data: any }>) => {
          const res = await call(request)
          expect({ status: res.status, message: res.data?.message }).toEqual({ status: 200, message: undefined })
          return res.data
        }

        expect((await ok(api.get(`/store/carts/${cartId}`, config))).cart.id).toEqual(cartId)
        await ok(api.post(`/store/carts/${cartId}`, { metadata: { note: "core12" } }, config))
        const added = await ok(
          api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantIds[1], quantity: 1 }, config)
        )
        const extraLine = added.cart.items.find((i) => i.variant_id === variantIds[1]).id
        await ok(api.post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 2 }, config))
        await ok(api.delete(`/store/carts/${cartId}/line-items/${extraLine}`, config))
        await ok(api.delete(`/store/carts/${cartId}/promotions`, { ...config, data: { promo_codes: [PROMO_CODE] } }))
        await ok(api.post(`/store/carts/${cartId}/promotions`, { promo_codes: [PROMO_CODE] }, config))
        await ok(api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: standardOptionId }, config))
        await ok(api.post(`/store/carts/${cartId}/taxes`, {}, config))
        await ok(api.post(`/store/carts/${cartId}/customer`, {}, config))

        const after = await snapshot(cartId)
        expect(after).toMatchObject({
          metadata: { note: "core12" },
          items: [[variantIds[0], 2]],
          promotions: [PROMO_CODE],
          customer_id: customerA.id,
        })

        // Medusa ล้าง payment session เมื่อ cart เปลี่ยน — สร้างใหม่ก่อน complete (พฤติกรรมเดิมของ Medusa)
        const { data: refreshed } = await api.get(`/store/carts/${cartId}?fields=payment_collection.id`, config)
        await ok(
          api.post(
            `/store/payment-collections/${refreshed.cart.payment_collection.id}/payment-sessions`,
            { provider_id: "pp_system_default" },
            config
          )
        )
        const completed = await ok(api.post(`/store/carts/${cartId}/complete`, {}, config))
        expect(completed.type).toEqual("order")
        const order = await ok(api.get(`/store/orders/${completed.order.id}?fields=id,customer_id`, config))
        expect(order.order.customer_id).toEqual(customerA.id)
      })
    })

    describe("AC-35: payment collections and shipping options", () => {
      it("customer B gets 404 and no payment session is created; A gets through", async () => {
        const { cartId, paymentCollectionId } = await prepareCartOfA()
        const before = await snapshot(cartId)
        const b = customerB.config

        const asB = {
          "POST /store/payment-collections": () => api.post("/store/payment-collections", { cart_id: cartId }, b),
          "POST /store/payment-collections/:id/payment-sessions": () => api.post(
            `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
            { provider_id: "pp_system_default" },
            b
          ),
          "GET /store/shipping-options": () => api.get(`/store/shipping-options?cart_id=${cartId}`, b),
          "POST /store/shipping-options/:id/calculate": () => api.post(
            `/store/shipping-options/${standardOptionId}/calculate`,
            { cart_id: cartId },
            b
          ),
        }
        for (const [name, request] of Object.entries(asB)) {
          expect({ name, status: (await call(request())).status }).toEqual({ name, status: 404 })
        }
        expect(await snapshot(cartId)).toEqual(before)

        const a = customerA.config
        const pc = await call(api.post("/store/payment-collections", { cart_id: cartId }, a))
        expect(pc.status).toEqual(200)
        expect(pc.data.payment_collection.id).toEqual(paymentCollectionId)
        const session = await call(
          api.post(
            `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
            { provider_id: "pp_system_default" },
            a
          )
        )
        expect(session.status).toEqual(200)
        const options = await call(api.get(`/store/shipping-options?cart_id=${cartId}`, a))
        expect(options.status).toEqual(200)
        expect(options.data.shipping_options.map((o) => o.id)).toContain(standardOptionId)

        // "Standard" เป็นราคา flat ของ manual provider ซึ่งคำนวณราคาไม่ได้: A ผ่าน auth + ownership ไปถึง handler
        // ของ Medusa แล้ว provider throw → 500 (พฤติกรรมเดิมของ Medusa ไม่เกี่ยวกับ CORE-12)
        const calculate = await call(
          api.post(`/store/shipping-options/${standardOptionId}/calculate`, { cart_id: cartId }, a)
        )
        expect({ status: calculate.status, type: calculate.data?.type }).toEqual({ status: 500, type: "unknown_error" })
      })

      it("POST /store/payment-collections/:id/payment-sessions/:session_id → 404 for B; A gets through", async () => {
        const { paymentCollectionId } = await prepareCartOfA()
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "payment_collection",
          fields: ["payment_sessions.id", "payment_sessions.data"],
          filters: { id: paymentCollectionId },
        })
        const session = (data[0] as any).payment_sessions[0]
        const url = `/store/payment-collections/${paymentCollectionId}/payment-sessions/${session.id}`
        const body = { client_data: { note: "core12" } }

        expect((await call(api.post(url, body, customerB.config))).status).toEqual(404)
        const mine = await call(api.post(url, body, customerA.config))
        expect({ status: mine.status, message: mine.data?.message }).toEqual({ status: 200, message: undefined })
      })

      it("shipping options require a customer session (401 without token)", async () => {
        const { cartId } = await prepareCartOfA()
        expect((await call(api.get(`/store/shipping-options?cart_id=${cartId}`, guestHeaders))).status).toEqual(401)
        expect(
          (
            await call(
              api.post(`/store/shipping-options/${standardOptionId}/calculate`, { cart_id: cartId }, guestHeaders)
            )
          ).status
        ).toEqual(401)
      })
    })

    describe("AC-36 / AC-37: orders", () => {
      it("GET /store/orders/:id → 401 without token, 404 for B, 200 for A; GET /store/carts/:id → 401 without token", async () => {
        const { cartId } = await prepareCartOfA()
        expect((await call(api.get(`/store/carts/${cartId}`, guestHeaders))).status).toEqual(401)

        const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, customerA.config)
        expect(data.type).toEqual("order")
        const orderId = data.order.id

        expect((await call(api.get(`/store/orders/${orderId}`, guestHeaders))).status).toEqual(401)
        expect((await call(api.get(`/store/orders/${orderId}`, customerB.config))).status).toEqual(404)
        const mine = await call(api.get(`/store/orders/${orderId}`, customerA.config))
        expect(mine.status).toEqual(200)
        expect(mine.data.order.id).toEqual(orderId)

        // payment collection ของ order ที่ complete แล้ว: เจ้าของยังเป็น A
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["payment_collections.id"],
          filters: { id: orderId },
        })
        const pcId = (orders[0] as any).payment_collections[0].id
        expect(
          (
            await call(
              api.post(
                `/store/payment-collections/${pcId}/payment-sessions`,
                { provider_id: "pp_system_default" },
                customerB.config
              )
            )
          ).status
        ).toEqual(404)
      })

      it("an order id that does not exist → 404", async () => {
        expect((await call(api.get("/store/orders/order_doesnotexist", customerA.config))).status).toEqual(404)
      })
    })

    describe("AC-38: cart without customer", () => {
      it("a cart with customer_id null (created through the Cart module) → 404 for any customer", async () => {
        const [cart] = await getContainer()
          .resolve(Modules.CART)
          .createCarts([{ currency_code: "thb", region_id: regionId }])
        expect(cart.customer_id).toBeNull()

        expect((await call(api.get(`/store/carts/${cart.id}`, customerA.config))).status).toEqual(404)
        expect((await call(api.get(`/store/carts/${cart.id}`, customerB.config))).status).toEqual(404)
        expect((await call(api.get("/store/carts/cart_doesnotexist", customerA.config))).status).toEqual(404)
      })
    })
  },
})
