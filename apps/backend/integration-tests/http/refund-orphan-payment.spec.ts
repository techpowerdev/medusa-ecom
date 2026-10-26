import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import refundOrphanPaymentScript, { refundOrphanPayment } from "../../src/scripts/refund-orphan-payment"

jest.setTimeout(60 * 1000)

// PAY-6b2: ADR-015 ภาคผนวก 2 (owner 2026-10-26) — payment captured ที่ไม่มี order refund ผ่าน `refundPaymentsWorkflow` ของ Medusa
// (ไม่เรียก Stripe ตรง ไม่ refund ใน Stripe dashboard) ด้วย script `medusa exec ./src/scripts/refund-orphan-payment.ts <payment_id>`

/** payment captured 500 THB บน collection ที่ไม่ผูก order (provider system ของ Medusa — ไม่ออก network) */
async function capturedPayment(container: MedusaContainer, amount = 500) {
  const payment = container.resolve(Modules.PAYMENT)
  const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount }])
  const session = await payment.createPaymentSession(collection.id, {
    provider_id: "pp_system_default",
    currency_code: "thb",
    amount,
    data: {},
  })
  const authorized = await payment.authorizePaymentSession(session.id, {})
  await payment.capturePayment({ payment_id: authorized.id })
  return { paymentId: authorized.id, collectionId: collection.id }
}

async function refundsOf(container: MedusaContainer, paymentId: string) {
  return container.resolve(Modules.PAYMENT).listRefunds({ payment_id: paymentId })
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("script refund-orphan-payment", () => {
      it("refunds the full captured amount of a payment without an order", async () => {
        const container = getContainer()
        const { paymentId } = await capturedPayment(container)

        const result = await refundOrphanPayment(container, paymentId)

        expect(result).toEqual({ status: "refunded", amount: "500" })
        const refunds = await refundsOf(container, paymentId)
        expect(refunds).toHaveLength(1)
        expect(Number(refunds[0].amount)).toEqual(500)
      })

      it("is idempotent: running again does not refund twice", async () => {
        const container = getContainer()
        const { paymentId } = await capturedPayment(container)

        await refundOrphanPayment(container, paymentId)
        const again = await refundOrphanPayment(container, paymentId)

        expect(again).toEqual({ status: "already-refunded", amount: "0" })
        expect(await refundsOf(container, paymentId)).toHaveLength(1)
      })

      it("refuses a payment whose collection belongs to an order (use the admin refund instead)", async () => {
        const container = getContainer()
        const { paymentId, collectionId } = await capturedPayment(container)
        const order = await container.resolve(Modules.ORDER).createOrders({ currency_code: "thb", email: "a@x.test", items: [] })
        await container.resolve(ContainerRegistrationKeys.LINK).create({
          [Modules.ORDER]: { order_id: order.id },
          [Modules.PAYMENT]: { payment_collection_id: collectionId },
        })

        await expect(refundOrphanPayment(container, paymentId)).rejects.toThrow(order.id)
        expect(await refundsOf(container, paymentId)).toHaveLength(0)
      })

      it("refuses a payment that was never captured", async () => {
        const container = getContainer()
        const payment = container.resolve(Modules.PAYMENT)
        const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount: 100 }])
        const session = await payment.createPaymentSession(collection.id, {
          provider_id: "pp_system_default",
          currency_code: "thb",
          amount: 100,
          data: {},
        })
        const authorized = await payment.authorizePaymentSession(session.id, {})

        await expect(refundOrphanPayment(container, authorized.id)).rejects.toThrow(/captured/)
        expect(await refundsOf(container, authorized.id)).toHaveLength(0)
      })

      it("medusa exec entry point requires a payment id argument", async () => {
        await expect(refundOrphanPaymentScript({ container: getContainer(), args: [] } as any)).rejects.toThrow(/payment id/)
      })
    })
  },
})
