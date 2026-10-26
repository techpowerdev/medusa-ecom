import { readFileSync } from "fs"
import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import refundOrphanPaymentScript, { refundOrphanPayment } from "../../src/scripts/refund-orphan-payment"

jest.setTimeout(60 * 1000)

// PAY-6b2: ADR-015 ภาคผนวก 2 (owner 2026-10-26) — payment captured ที่ไม่มี order refund ผ่าน `refundPaymentsWorkflow` ของ Medusa
// (ไม่เรียก Stripe ตรง ไม่ refund ใน Stripe dashboard) ด้วย script `medusa exec ./src/scripts/refund-orphan-payment.ts <payment_id>`

/** payment บน collection ของ cart ที่ไม่มี order (provider system ของ Medusa = mock provider ไม่ออก network) */
async function cartPayment(container: MedusaContainer, amount: number) {
  const payment = container.resolve(Modules.PAYMENT)
  const cart = await container.resolve(Modules.CART).createCarts({ currency_code: "thb", email: "a@x.test" })
  const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount }])
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.CART]: { cart_id: cart.id },
    [Modules.PAYMENT]: { payment_collection_id: collection.id },
  })
  const session = await payment.createPaymentSession(collection.id, {
    provider_id: "pp_system_default",
    currency_code: "thb",
    amount,
    data: {},
  })
  const authorized = await payment.authorizePaymentSession(session.id, {})
  return { paymentId: authorized!.id, collectionId: collection.id }
}

/** payment captured 500 THB บน collection ของ cart ที่ไม่มี order */
async function capturedPayment(container: MedusaContainer, amount = 500) {
  const created = await cartPayment(container, amount)
  await container.resolve(Modules.PAYMENT).capturePayment({ payment_id: created.paymentId })
  return created
}

async function refundsOf(container: MedusaContainer, paymentId: string) {
  return container.resolve(Modules.PAYMENT).listRefunds({ payment_id: paymentId })
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("script refund-orphan-payment", () => {
      afterEach(() => {
        jest.restoreAllMocks()
      })

      it("refunds the full captured amount of a payment without an order", async () => {
        const container = getContainer()
        const { paymentId } = await capturedPayment(container)
        const refund = jest.spyOn(container.resolve(Modules.PAYMENT), "refundPayment")

        const result = await refundOrphanPayment(container, paymentId)

        expect(result).toEqual({ status: "refunded", amount: "500" })
        expect(refund).toHaveBeenCalledTimes(1)
        const refunds = await refundsOf(container, paymentId)
        expect(refunds).toHaveLength(1)
        expect(Number(refunds[0].amount)).toEqual(500)
      })

      it("is idempotent: running again does not refund twice", async () => {
        const container = getContainer()
        const { paymentId } = await capturedPayment(container)

        await refundOrphanPayment(container, paymentId)
        const refund = jest.spyOn(container.resolve(Modules.PAYMENT), "refundPayment")
        const info = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "info")
        await refundOrphanPaymentScript({ container, args: [paymentId] } as any)

        expect(refund).not.toHaveBeenCalled()
        expect(info.mock.calls.some(([msg]) => String(msg).includes("refund แล้ว"))).toBe(true)
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

        // throw = `medusa exec` exit 1
        await expect(refundOrphanPaymentScript({ container, args: [paymentId] } as any)).rejects.toThrow(order.id)
        expect(await refundsOf(container, paymentId)).toHaveLength(0)
      })

      it("refuses a payment that was never captured", async () => {
        const container = getContainer()
        const { paymentId } = await cartPayment(container, 100)

        await expect(refundOrphanPaymentScript({ container, args: [paymentId] } as any)).rejects.toThrow(/captured/)
        expect(await refundsOf(container, paymentId)).toHaveLength(0)
      })

      it("source does not import stripe (refund goes through Medusa's provider only)", () => {
        const source = readFileSync(path.resolve(__dirname, "../../src/scripts/refund-orphan-payment.ts"), "utf8")
        expect(source).not.toMatch(/from\s+["']stripe["']|require\(\s*["']stripe["']\s*\)/)
      })

      it("medusa exec entry point requires a payment id argument", async () => {
        await expect(refundOrphanPaymentScript({ container: getContainer(), args: [] } as any)).rejects.toThrow(/payment id/)
      })
    })
  },
})
