import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { renderEmailTemplate } from "../../src/modules/resend/templates"

jest.setTimeout(240 * 1000)

// CORE-11 (spec 01 กฎข้อ 20, AC-32): อีเมล shipped มีเฉพาะ item และจำนวนที่อยู่ใน fulfillment ของ shipment.created นั้น
// ใน test ไม่มี RESEND_API_KEY → channel "email" ใช้ provider `local` ของ Medusa (mock) และเก็บ notification ที่ส่งไว้
const ADMIN_EMAIL = "core11-admin@example.com"
const ADMIN_PASSWORD = "core11-test-password"
const CUSTOMER_EMAIL = "core11-customer@example.com"

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: Headers
    let order: { id: string; itemA: string; itemB: string }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const pk = await getPublishableKey(container)
      const customer = await registerCustomer(api, pk, CUSTOMER_EMAIL, "core11-customer-password")
      const config = storeHeadersFor(pk, customer.token)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["handle", "variants.id"],
        filters: { handle: ["t-shirt", "sweatshirt"] },
      })
      const variantOf = (handle: string) => products.find((p) => p.handle === handle)!.variants[0].id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })

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
          items: [
            { variant_id: variantOf("t-shirt"), quantity: 2 },
            { variant_id: variantOf("sweatshirt"), quantity: 1 },
          ],
        },
        config
      )
      const cartId: string = data.cart.id
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: options[0].id }, config)
      const { data: pc } = await api.post("/store/payment-collections", { cart_id: cartId }, config)
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        config
      )
      const { data: completed } = await api.post(`/store/carts/${cartId}/complete`, {}, config)
      expect(completed.type).toEqual("order")

      const items: { id: string; quantity: number; variant_id: string }[] = completed.order.items
      order = {
        id: completed.order.id,
        itemA: items.find((i) => i.variant_id === variantOf("t-shirt"))!.id,
        itemB: items.find((i) => i.variant_id === variantOf("sweatshirt"))!.id,
      }

      const { data: auth } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${auth.token}` } }
    })

    it("AC-32: shipped email lists only item A × 1 when admin ships a fulfillment of A qty 1", async () => {
      const container = getContainer()

      const { data: fulfilled } = await api.post(
        `/admin/orders/${order.id}/fulfillments?fields=id,fulfillments.id`,
        { items: [{ id: order.itemA, quantity: 1 }], no_notification: false },
        adminHeaders
      )
      const fulfillmentId: string = fulfilled.order.fulfillments[0].id

      const eventBus = container.resolve(Modules.EVENT_BUS)
      const shipped = TestEventUtils.waitSubscribersExecution("shipment.created", eventBus)
      await api.post(
        `/admin/orders/${order.id}/fulfillments/${fulfillmentId}/shipments`,
        {
          items: [{ id: order.itemA, quantity: 1 }],
          labels: [
            {
              tracking_number: "TH-CORE11",
              tracking_url: "https://track.example.com/TH-CORE11",
              label_url: "https://track.example.com/label.pdf",
            },
          ],
          no_notification: false,
        },
        adminHeaders
      )
      await shipped

      const notificationModule = container.resolve(Modules.NOTIFICATION)
      const notifications = await notificationModule.listNotifications({
        template: "order-shipped",
        channel: "email",
        resource_id: fulfillmentId,
      })
      expect(notifications).toHaveLength(1)
      expect(notifications[0].to).toEqual(CUSTOMER_EMAIL)

      const emailItems = (notifications[0].data!.order as { items: { id: string; quantity: number }[] }).items
      expect(emailItems.map(({ id, quantity }) => ({ id, quantity }))).toEqual([{ id: order.itemA, quantity: 1 }])
      expect(emailItems.some((item) => item.id === order.itemB)).toBe(false)

      const email = renderEmailTemplate("order-shipped", notifications[0].data!)
      expect(email!.html).toContain("× 1")
      expect(email!.html).not.toContain("× 2")
      expect(email!.html).toContain("TH-CORE11")
    })
  },
})
