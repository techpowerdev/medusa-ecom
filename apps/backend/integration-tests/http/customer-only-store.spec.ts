import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { CUSTOMER_REQUIRED_MESSAGE } from "../../src/lib/customer-only"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// CORE-6: spec 01 "ไม่มี guest" + AC-6 (401 เมื่อไม่มี customer session) และ AC-1 ระดับ API
// (cart → order ด้วย manual payment provider → admin capture)
const ADMIN_EMAIL = "core6-admin@example.com"
const ADMIN_PASSWORD = "core6-test-password"
const CUSTOMER_EMAIL = "core6-buyer@example.com"
const CUSTOMER_PASSWORD = "core6-buyer-password"

const SHIPPING_ADDRESS = {
  first_name: "Somchai",
  last_name: "Jaidee",
  address_1: "1 Sukhumvit Rd",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

type HttpError = { response?: { status: number; data?: { message?: string } } }
const statusOf = (request: Promise<unknown>) =>
  request.then(
    () => 200,
    (e: HttpError) => e.response?.status
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let variantId: string
    let customerId: string
    let guestHeaders: { headers: Record<string, string> }
    let customerHeaders: { headers: Record<string, string> }
    let adminHeaders: { headers: Record<string, string> }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container: getContainer(), args: [] })
      pk = await getPublishableKey(getContainer())
      guestHeaders = storeHeadersFor(pk)

      const { data: regions } = await api.get("/store/regions", guestHeaders)
      regionId = regions.regions[0].id
      const { data: products } = await api.get(
        `/store/products?handle=t-shirt&region_id=${regionId}&fields=*variants`,
        guestHeaders
      )
      variantId = products.products[0].variants[0].id

      const customer = await registerCustomer(api, pk, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
      customerId = customer.customerId
      customerHeaders = storeHeadersFor(pk, customer.token)

      const { data: admin } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${admin.token}` } }
    })

    const createCart = async () => {
      const { data } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }] },
        customerHeaders
      )
      return data.cart
    }

    describe("browsing stays public", () => {
      it("GET /store/products and /store/regions work without a customer session", async () => {
        expect(await statusOf(api.get("/store/products", guestHeaders))).toEqual(200)
        expect(await statusOf(api.get("/store/regions", guestHeaders))).toEqual(200)
      })
    })

    describe("AC-6: cart and checkout routes require a customer session", () => {
      it("POST /store/carts without a session → 401", async () => {
        const status = await statusOf(api.post("/store/carts", { region_id: regionId }, guestHeaders))
        expect(status).toEqual(401)
      })

      it("POST /store/carts with an email but no session → 401 (no guest checkout)", async () => {
        const status = await statusOf(
          api.post("/store/carts", { region_id: regionId, email: "guest@example.com" }, guestHeaders)
        )
        expect(status).toEqual(401)
      })

      it("POST /store/carts/:id/line-items without a session → 401", async () => {
        const cart = await createCart()
        const status = await statusOf(
          api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 1 }, guestHeaders)
        )
        expect(status).toEqual(401)
      })

      it("GET/POST /store/carts/:id and POST /store/payment-collections without a session → 401", async () => {
        const cart = await createCart()
        expect(await statusOf(api.get(`/store/carts/${cart.id}`, guestHeaders))).toEqual(401)
        expect(await statusOf(api.post(`/store/carts/${cart.id}`, { email: "x@example.com" }, guestHeaders))).toEqual(
          401
        )
        expect(await statusOf(api.post(`/store/carts/${cart.id}/complete`, {}, guestHeaders))).toEqual(401)
        expect(
          await statusOf(api.post("/store/payment-collections", { cart_id: cart.id }, guestHeaders))
        ).toEqual(401)
      })

      it("an admin token is not a customer session → 401", async () => {
        const status = await statusOf(
          api.post("/store/carts", { region_id: regionId }, { headers: { ...guestHeaders.headers, ...adminHeaders.headers } })
        )
        expect(status).toEqual(401)
      })

      it("with a customer session the cart is created for that customer and items can be added", async () => {
        const cart = await createCart()
        expect(cart.customer_id).toEqual(customerId)
        expect(cart.email).toEqual(CUSTOMER_EMAIL)

        const { data } = await api.post(
          `/store/carts/${cart.id}/line-items`,
          { variant_id: variantId, quantity: 1 },
          customerHeaders
        )
        expect(data.cart.items[0].quantity).toEqual(2)
      })
    })

    describe("createCartWorkflow validate hook (defence beyond the route)", () => {
      const run = (input: Record<string, unknown>) =>
        createCartWorkflow(getContainer())
          .run({ input: { region_id: regionId, ...input } })
          .then(
            () => undefined,
            (e: MedusaError) => e
          )

      it("rejects a cart without customer_id", async () => {
        const error = await run({})
        expect(error).toMatchObject({ type: MedusaError.Types.NOT_ALLOWED, message: CUSTOMER_REQUIRED_MESSAGE })
      })

      it("rejects a cart for an email-only guest customer", async () => {
        const error = await run({ email: "walk-in@example.com" })
        expect(error).toMatchObject({ type: MedusaError.Types.NOT_ALLOWED, message: CUSTOMER_REQUIRED_MESSAGE })

        // ไม่มี cart ค้างจาก workflow ที่ถูกปฏิเสธ
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "cart", fields: ["id"], filters: { email: "walk-in@example.com" } })
        expect(data).toHaveLength(0)
      })

      it("accepts a registered customer", async () => {
        const error = await run({ customer_id: customerId })
        expect(error).toBeUndefined()
      })
    })

    describe("AC-1 (API): cart → order with the manual payment provider → admin capture", () => {
      it("order is authorized after checkout and captured after admin capture", async () => {
        const cart = await createCart()
        await api.post(`/store/carts/${cart.id}`, { shipping_address: SHIPPING_ADDRESS }, customerHeaders)

        const { data: options } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, customerHeaders)
        const standard = options.shipping_options.find((o: { name: string }) => o.name === "Standard")
        await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: standard.id }, customerHeaders)

        const { data: pc } = await api.post("/store/payment-collections", { cart_id: cart.id }, customerHeaders)
        await api.post(
          `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          customerHeaders
        )

        const { data: completed } = await api.post(`/store/carts/${cart.id}/complete`, {}, customerHeaders)
        expect(completed.type).toEqual("order")
        const orderId = completed.order.id

        const fields = "id,customer_id,payment_status,currency_code,*payment_collections.payments"
        const { data: before } = await api.get(`/admin/orders/${orderId}?fields=${fields}`, adminHeaders)
        expect(before.order).toMatchObject({ customer_id: customerId, payment_status: "authorized", currency_code: "thb" })

        const paymentId = before.order.payment_collections[0].payments[0].id
        await api.post(`/admin/payments/${paymentId}/capture`, {}, adminHeaders)

        const { data: after } = await api.get(`/admin/orders/${orderId}?fields=${fields}`, adminHeaders)
        expect(after.order.payment_status).toEqual("captured")

        // AC-3 (API): order อยู่ใน "My orders" ของลูกค้า
        const { data: mine } = await api.get("/store/orders", customerHeaders)
        expect(mine.orders.map((o: { id: string }) => o.id)).toContain(orderId)
      })
    })
  },
})
