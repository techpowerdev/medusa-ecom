import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PaymentEvents, ProductStatus } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  capturePaymentWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { createAdminUser } from "../helpers/admin"
import { shipOrderItems } from "../helpers/ship-order"

jest.setTimeout(300 * 1000)
process.env.AFFILIATE_TOKEN_SECRET = "pay8-integration-secret"

// PAY-8 (spec 06 กฎข้อ 10, AC-21 — bug B-1): refundPaymentWorkflow ของ Medusa 2.22.1 คืนเงินที่ provider ก่อน
// แล้วจึงสร้าง credit line ซึ่งล้มเมื่อ order มี active order change → เงินคืนจริงแต่ admin เห็น 400 และไม่มี payment.refunded
// middleware ต้องตอบ 400 ก่อนถึง provider; provider ในที่นี้คือ pp_system_default ที่นับการเรียก refundPayment (ไม่เรียก Stripe)
type HttpError = { response?: { status: number; data?: { type?: string; message?: string } } }
type Headers = { headers: Record<string, string> }

// กฎ CLAUDE.md: ไม่ปล่อย error ของ axios (circular) ออกจาก test
const responseOf = (request: Promise<{ status: number; data: unknown }>) =>
  request.then(
    ({ status, data }) => ({ status, data: data as { type?: string; message?: string } }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน test
const ok = async (request: Promise<{ status: number; data: any }>) => {
  try {
    return await request
  } catch (e) {
    const { response } = e as HttpError
    throw new Error(`${response?.status} ${JSON.stringify(response?.data)}`)
  }
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let admin: Headers
    let regionId: string
    let shippingOptionId: string
    let variantId: string
    let refundCalls: jest.SpyInstance
    let emit: jest.SpyInstance
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = "pay8-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "pay8-test-password"
      await seedThailand({ container, args: [] })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "shipping_profile_id"],
        filters: { name: "Standard" },
      })
      shippingOptionId = options[0].id
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "pay8-600",
              handle: "pay8-600",
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: options[0].shipping_profile_id,
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  manage_inventory: false,
                  options: { Size: "One" },
                  prices: [{ currency_code: "thb", amount: 600 }],
                },
              ],
              sales_channels: [{ id: channels[0].id }],
            },
          ],
        },
      })
      variantId = result[0].variants[0].id
    })

    beforeEach(async () => {
      seq += 1
      admin = (await createAdminUser(container, `pay8-admin-${seq}@example.com`)) as Headers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider ภายใน payment module (mock ด้วย spy)
      const providers = (container.resolve(Modules.PAYMENT) as any).paymentProviderService_
      refundCalls = jest.spyOn(providers.retrieveProvider("pp_system_default"), "refundPayment")
      emit = jest.spyOn(container.resolve(Modules.EVENT_BUS), "emit")
    })

    afterEach(() => jest.restoreAllMocks())

    // order ฿600 (+ ค่าส่ง) ที่ capture แล้วและส่งของแล้ว (ให้ขอคืนได้)
    const placeCapturedOrder = async () => {
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email: `pay8-${seq}@example.com`, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          email: customer.email,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items: [{ variant_id: variantId, quantity: 1 }],
        },
      })
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: [{ id: shippingOptionId }] },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: "pp_system_default" },
      })
      const { result: order } = await completeCartWorkflow(container).run({ input: { id: cart.id } })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: order.id },
      })
      const paymentId = data[0].payment_collections![0]!.payments![0]!.id
      await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })
      const itemId = data[0].items![0]!.id
      await shipOrderItems(container, order.id, [{ id: itemId, quantity: 1 }])
      return { orderId: order.id, paymentId, itemId }
    }

    const refund = (paymentId: string, amount: number) =>
      responseOf(api.post(`/admin/payments/${paymentId}/refund`, { amount }, admin))

    const refundedEvents = () =>
      emit.mock.calls
        .flatMap(([messages]) => (Array.isArray(messages) ? messages : [messages]))
        .filter((m: { name: string }) => m.name === PaymentEvents.REFUNDED)

    const stateOf = async (orderId: string, paymentId: string) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: payments } = await query.graph({
        entity: "payment",
        fields: ["refunds.id"],
        filters: { id: paymentId },
      })
      const { data } = await ok(
        api.get(`/admin/orders/${orderId}?fields=payment_status,summary,*credit_lines`, admin)
      )
      return {
        refunds: payments[0].refunds!.length,
        refunded_total: Number(data.order.summary.refunded_total),
        payment_status: data.order.payment_status as string,
        credit_lines: (data.order.credit_lines as unknown[]).length,
      }
    }

    const expectBlocked = async (orderId: string, paymentId: string) => {
      const res = await refund(paymentId, 100)
      expect(res.status).toBe(400)
      // B-1: ก่อนแก้ provider ถูกเรียก (เงินคืนจริง) แล้ว credit line ล้มเป็น 400 invalid_data
      expect(refundCalls).not.toHaveBeenCalled()
      expect(await stateOf(orderId, paymentId)).toMatchObject({ refunds: 0, refunded_total: 0 })
      expect(refundedEvents()).toHaveLength(0)
      expect(res.data?.type).toBe("not_allowed")
      expect(res.data?.message).toBe(
        "Cannot refund while this order has an active return, claim, exchange or edit. Confirm or cancel it first."
      )
    }

    const requestReturn = async (orderId: string, itemId: string) => {
      const { data } = await ok(api.post("/admin/returns", { order_id: orderId }, admin))
      const returnId = data.return.id as string
      await ok(api.post(`/admin/returns/${returnId}/request-items`, { items: [{ id: itemId, quantity: 1 }] }, admin))
      return returnId
    }

    it("AC-21a: blocks a refund while a return request is not confirmed, before the provider is called", async () => {
      const { orderId, paymentId, itemId } = await placeCapturedOrder()
      await requestReturn(orderId, itemId)
      await expectBlocked(orderId, paymentId)
    })

    it("AC-21b: blocks a refund while an order edit is pending", async () => {
      const { orderId, paymentId } = await placeCapturedOrder()
      await ok(api.post("/admin/order-edits", { order_id: orderId }, admin))
      await expectBlocked(orderId, paymentId)
    })

    it("AC-21c: after the return request is canceled the refund goes through once with a credit line and payment.refunded", async () => {
      const { orderId, paymentId, itemId } = await placeCapturedOrder()
      const returnId = await requestReturn(orderId, itemId)
      await ok(api.delete(`/admin/returns/${returnId}/request`, admin))

      const refunded = TestEventUtils.waitSubscribersExecution(
        PaymentEvents.REFUNDED,
        container.resolve(Modules.EVENT_BUS)
      )
      const res = await refund(paymentId, 100)
      expect(res.status).toBe(200)
      await refunded
      expect(refundCalls).toHaveBeenCalledTimes(1)
      expect(refundedEvents()).toHaveLength(1)
      expect(await stateOf(orderId, paymentId)).toEqual({
        refunds: 1,
        refunded_total: 100,
        payment_status: "partially_refunded",
        credit_lines: 1,
      })
    })

    it("AC-21d: an order without an order change refunds as before (AC-6)", async () => {
      const { orderId, paymentId } = await placeCapturedOrder()
      const res = await refund(paymentId, 100)
      expect(res.status).toBe(200)
      expect(refundCalls).toHaveBeenCalledTimes(1)
      expect(await stateOf(orderId, paymentId)).toMatchObject({
        refunds: 1,
        refunded_total: 100,
        payment_status: "partially_refunded",
      })
    })
  },
})
