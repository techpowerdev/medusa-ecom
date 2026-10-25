import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { renderEmailTemplate } from "../../src/modules/resend/templates"

jest.setTimeout(60 * 1000)

// CORE-3: subscriber ของ order.placed / shipment.created ส่งอีเมลผ่าน Notification Module ของ Medusa
// ใน test ไม่มี RESEND_API_KEY → channel "email" fallback เป็น provider `local` ของ Medusa (ไม่เรียก API จริง)
const CUSTOMER_EMAIL = "somchai@example.com"

const createOrder = async (container: MedusaContainer) => {
  const orderModule = container.resolve(Modules.ORDER)

  return await orderModule.createOrders({
    email: CUSTOMER_EMAIL,
    currency_code: "thb",
    items: [
      {
        title: "500g",
        product_title: "Thai Tea",
        variant_title: "500g",
        quantity: 2,
        unit_price: 250,
      },
    ],
  })
}

const emitAndWait = async (
  container: MedusaContainer,
  name: string,
  data: Record<string, unknown>
) => {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const subscribersDone = TestEventUtils.waitSubscribersExecution(name, eventBus)
  await eventBus.emit({ name, data })
  await subscribersDone
}

const listEmails = async (
  container: MedusaContainer,
  template: string,
  resourceId: string
) => {
  const notificationModule = container.resolve(Modules.NOTIFICATION)
  return await notificationModule.listNotifications({
    template,
    channel: "email",
    resource_id: resourceId,
  })
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("order notifications", () => {
      describe("order.placed", () => {
        it("sends an order-placed email to the order's email with the order data", async () => {
          const container = getContainer()
          const order = await createOrder(container)

          await emitAndWait(container, "order.placed", { id: order.id })

          const notifications = await listEmails(container, "order-placed", order.id)
          expect(notifications).toHaveLength(1)
          expect(notifications[0]).toEqual(
            expect.objectContaining({
              to: CUSTOMER_EMAIL,
              channel: "email",
              template: "order-placed",
              status: "success",
              resource_id: order.id,
              resource_type: "order",
              data: expect.objectContaining({
                order: expect.objectContaining({
                  id: order.id,
                  display_id: order.display_id,
                  currency_code: "thb",
                  total: 500,
                  items: [expect.objectContaining({ quantity: 2, total: 500 })],
                }),
              }),
            })
          )

          // template ที่ Resend provider ใช้ render ได้จากข้อมูลจริงที่ workflow query มา
          const email = renderEmailTemplate("order-placed", notifications[0].data!)
          expect(email!.subject).toContain(`#${order.display_id}`)
          expect(email!.html).toContain("Thai Tea — 500g × 2")
          expect(email!.html).toContain("฿500.00")
        })

        it("does not send the same order-placed email twice", async () => {
          const container = getContainer()
          const order = await createOrder(container)

          await emitAndWait(container, "order.placed", { id: order.id })
          await emitAndWait(container, "order.placed", { id: order.id })

          const notifications = await listEmails(container, "order-placed", order.id)
          expect(notifications).toHaveLength(1)
        })
      })

      describe("shipment.created", () => {
        const createShippedFulfillment = async (container: MedusaContainer, orderId: string) => {
          const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
          const link = container.resolve(ContainerRegistrationKeys.LINK)

          const fulfillment = await fulfillmentModule.createFulfillment({
            location_id: "sloc_test",
            provider_id: "manual_manual",
            shipped_at: new Date(),
            delivery_address: { first_name: "Somchai", country_code: "th" },
            items: [],
            labels: [
              {
                tracking_number: "TH123456789",
                tracking_url: "https://track.example.com/TH123456789",
                label_url: "https://track.example.com/label.pdf",
              },
            ],
            order: {},
          })

          await link.create({
            [Modules.ORDER]: { order_id: orderId },
            [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
          })

          return fulfillment
        }

        it("sends an order-shipped email with tracking labels (AC-2)", async () => {
          const container = getContainer()
          const order = await createOrder(container)
          const fulfillment = await createShippedFulfillment(container, order.id)

          await emitAndWait(container, "shipment.created", {
            id: fulfillment.id,
            no_notification: false,
          })

          const notifications = await listEmails(container, "order-shipped", fulfillment.id)
          expect(notifications).toHaveLength(1)
          expect(notifications[0]).toEqual(
            expect.objectContaining({
              to: CUSTOMER_EMAIL,
              channel: "email",
              template: "order-shipped",
              status: "success",
              resource_id: fulfillment.id,
              resource_type: "fulfillment",
              data: expect.objectContaining({
                order: expect.objectContaining({ id: order.id }),
                fulfillment: expect.objectContaining({
                  labels: [
                    expect.objectContaining({ tracking_number: "TH123456789" }),
                  ],
                }),
              }),
            })
          )

          const email = renderEmailTemplate("order-shipped", notifications[0].data!)
          expect(email!.html).toContain("TH123456789")
        })

        it("skips the email when the shipment was created with no_notification", async () => {
          const container = getContainer()
          const order = await createOrder(container)
          const fulfillment = await createShippedFulfillment(container, order.id)

          await emitAndWait(container, "shipment.created", {
            id: fulfillment.id,
            no_notification: true,
          })

          const notifications = await listEmails(container, "order-shipped", fulfillment.id)
          expect(notifications).toHaveLength(0)
        })
      })
    })
  },
})
