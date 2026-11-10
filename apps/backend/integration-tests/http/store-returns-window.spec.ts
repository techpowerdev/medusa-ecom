import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand, { RETURN_OPTION_TYPE_CODE } from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { shipOrderItems } from "../helpers/ship-order"

jest.setTimeout(240 * 1000)

// CORE-20b (owner Q-F6 2026-10-27, AC-95): POST /store/returns บังคับช่วงคืน N วัน (return_window_days ใน metadata ของ
// region ของ order) นับจาก delivered_at ของ fulfillment ที่มี line นั้น ถ้าไม่มีใช้ shipped_at และกัน line ที่ไม่ต้องจัดส่ง
type Headers = { headers: Record<string, string> }
type ErrorBody = { type?: string; code?: string; message?: string }
type HttpError = { response?: { status: number; data?: ErrorBody } }

const DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

const responseOf = (request: Promise<{ status: number; data: unknown }>) =>
  request.then(
    ({ status, data }) => ({ status, data: data as ErrorBody }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let owner: Headers
    let other: Headers
    let guest: Headers
    let regionId: string
    let variantId: string
    let standardOptionId: string
    let returnOptionId: string
    type Order = { id: string; itemId: string }

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "core20b-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "core20b-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      const a = await registerCustomer(api, pk, "core20b-a@example.com", "core20b-a-password")
      const b = await registerCustomer(api, pk, "core20b-b@example.com", "core20b-b-password")
      owner = storeHeadersFor(pk, a.token)
      other = storeHeadersFor(pk, b.token)
      guest = storeHeadersFor(pk)

      // ช่วงคืนของ region ของ order = 7 วัน (ต่างจากค่าเริ่มต้น 30) — ยืนยันว่า middleware อ่านจาก region จริง
      const { data: regions } = await query().graph({ entity: "region", fields: ["id", "metadata"] })
      regionId = regions[0].id
      await container.resolve(Modules.REGION).updateRegions(regionId, {
        metadata: { ...(regions[0].metadata ?? {}), return_window_days: WINDOW_DAYS },
      })
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
      returnOptionId = returnOptions[0].id
    })

    // แต่ละ case ใช้ order ของตัวเอง — case หนึ่งล้มไม่ทำให้ case อื่นล้มตาม
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
          items: [{ variant_id: variantId, quantity: 1 }],
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
      return { id: completed.order.id, itemId: completed.order.items[0].id }
    }

    const shippedOrder = async (dates: { shipped_at: Date; delivered_at?: Date }) => {
      const order = await placeOrder()
      const fulfillmentId = await shipOrderItems(getContainer(), order.id, [{ id: order.itemId, quantity: 1 }])
      await getContainer().resolve(Modules.FULFILLMENT).updateFulfillment(fulfillmentId, dates)
      return order
    }

    const returnsOf = async (order: Order) => {
      const { data } = await query().graph({ entity: "return", fields: ["id"], filters: { order_id: order.id } })
      return data
    }

    const body = (order: Order, itemId = order.itemId) => ({
      order_id: order.id,
      items: [{ id: itemId, quantity: 1 }],
      return_shipping: { option_id: returnOptionId },
    })

    const expectRejected = async (order: Order, code: string, payload = body(order)) => {
      const { status, data } = await responseOf(api.post("/store/returns", payload, owner))
      expect({ status, type: data?.type, code: data?.code }).toEqual({ status: 400, type: "invalid_data", code })
      expect(data?.message).not.toContain(order.itemId)
      expect(await returnsOf(order)).toEqual([])
      return data
    }

    const expectAccepted = async (order: Order) => {
      const { status, data } = await api.post("/store/returns", body(order), owner)
      expect(status).toEqual(200)
      expect((await returnsOf(order)).map((r) => r.id)).toEqual([data.return.id])
    }

    it("shipped return_window_days + 1 days ago → 400 RETURN_WINDOW_EXPIRED and no return", async () => {
      await expectRejected(await shippedOrder({ shipped_at: daysAgo(WINDOW_DAYS + 1) }), "RETURN_WINDOW_EXPIRED")
    })

    it("shipped 1 day ago → 200 and the return is created", async () => {
      await expectAccepted(await shippedOrder({ shipped_at: daysAgo(1) }))
    })

    it("delivered_at takes precedence over shipped_at", async () => {
      await expectAccepted(await shippedOrder({ shipped_at: daysAgo(WINDOW_DAYS + 5), delivered_at: daysAgo(1) }))
      await expectRejected(
        await shippedOrder({ shipped_at: daysAgo(1), delivered_at: daysAgo(WINDOW_DAYS + 1) }),
        "RETURN_WINDOW_EXPIRED"
      )
    })

    it("a line that does not require shipping (e-voucher) → 400 RETURN_ITEM_NOT_SHIPPABLE", async () => {
      const order = await shippedOrder({ shipped_at: daysAgo(1) })
      // แทน line e-voucher (spec 02 กฎข้อ 6): line ของ order ที่ requires_shipping = false
      await getContainer().resolve(Modules.ORDER).updateOrderLineItems(order.itemId, { requires_shipping: false })
      await expectRejected(order, "RETURN_ITEM_NOT_SHIPPABLE")
    })

    it("fulfilled but not shipped yet → 400 RETURN_ITEM_NOT_SHIPPED", async () => {
      const order = await placeOrder()
      await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: order.id, items: [{ id: order.itemId, quantity: 1 }] },
      })
      await expectRejected(order, "RETURN_ITEM_NOT_SHIPPED")
    })

    it("an item id that is not a line of the order → 400 and the message does not echo the input", async () => {
      const order = await shippedOrder({ shipped_at: daysAgo(1) })
      const injected = "ordli_<script>x</script>"
      const data = await expectRejected(order, "RETURN_ITEM_NOT_SHIPPABLE", body(order, injected))
      expect(data?.message).not.toContain("<script>")
    })

    // CORE-20d (spec 01 กฎข้อ 66b): storefront คิดช่วงคืนต่อ line แบบเดียวกับ middleware นี้ — ต้องรู้ว่า fulfillment ไหนมี line ใด
    // core จำกัด field ของ GET /store/orders/:id ไว้ (ไม่มี fulfillments.items) → เปิดเฉพาะ line_item_id ให้เจ้าของ order
    it("GET /store/orders/:id returns fulfillments.items.line_item_id to the owner only", async () => {
      const order = await shippedOrder({ shipped_at: daysAgo(1) })
      const url = `/store/orders/${order.id}?fields=id,*fulfillments,+fulfillments.items.line_item_id`
      const { status, data } = await api.get(url, owner)
      expect(status).toEqual(200)
      const fulfillments = data.order.fulfillments as { items?: Record<string, unknown>[] }[]
      expect(fulfillments.map((f) => f.items?.map((i) => i.line_item_id))).toEqual([[order.itemId]])
      expect((await responseOf(api.get(url, other))).status).toEqual(404)
    })

    it("middleware order: no token → 401, customer B → 404 (ownership runs before this check)", async () => {
      const order = await shippedOrder({ shipped_at: daysAgo(WINDOW_DAYS + 1) })
      expect((await responseOf(api.post("/store/returns", body(order), guest))).status).toEqual(401)
      expect((await responseOf(api.post("/store/returns", body(order), other))).status).toEqual(404)
      expect(await returnsOf(order)).toEqual([])
    })
  },
})
