import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refundPaymentsWorkflow } from "@medusajs/medusa/core-flows"
import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import refundFailureScanJob, { config, scanRefundFailures } from "../../src/jobs/refund-failure-scan"

jest.setTimeout(60 * 1000)

// PAY-20: spec 06 กฎข้อ 22 / AC-33a–d (ADR-029 ก) — job ตรวจแถว refund ที่ล้ม/ค้างของ Payment module แล้วแจ้ง OPS_ALERT_EMAIL
// provider = pp_system_default ของ Medusa (ไม่ออก network) — ทำให้ล้มที่ระดับ provider (`refundPayment` ของ provider throw)
// เพื่อให้ Payment module สร้างแถว refund `failed` + soft-delete จริง (review #549)

const OPS_EMAIL = "ops@x.test"
const PROVIDER = "pp_system_default"
const MINUTE = 60_000

/** payment captured บน collection ของ cart ที่ไม่มี order */
async function capturedCartPayment(container: MedusaContainer, amount = 500) {
  const payment = container.resolve(Modules.PAYMENT)
  const cart = await container.resolve(Modules.CART).createCarts({ currency_code: "thb", email: "a@x.test" })
  const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount }])
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.CART]: { cart_id: cart.id },
    [Modules.PAYMENT]: { payment_collection_id: collection.id },
  })
  const session = await payment.createPaymentSession(collection.id, {
    provider_id: PROVIDER,
    currency_code: "thb",
    amount,
    data: {},
  })
  const authorized = await payment.authorizePaymentSession(session.id, {})
  await payment.capturePayment({ payment_id: authorized!.id })
  return { paymentId: authorized!.id, cartId: cart.id }
}

/** provider ของ Medusa (instance เดียวใน container ของ module) — spy ที่ provider ไม่ใช่ที่ paymentModule */
const provider = (container: MedusaContainer) =>
  (container.resolve(Modules.PAYMENT) as any).paymentProviderService_.retrieveProvider(PROVIDER)

/** refundPaymentsWorkflow ขณะ provider ปฏิเสธ (เช่น Stripe "Cannot send email") */
async function failedRefund(container: MedusaContainer, paymentId: string, amount = 500) {
  jest.spyOn(provider(container), "refundPayment").mockRejectedValueOnce(new Error("Cannot send email"))
  const { result } = await refundPaymentsWorkflow(container).run({ input: [{ payment_id: paymentId, amount }] })
  return result
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("job refund-failure-scan (AC-33)", () => {
      let logger: Logger
      let errorLog: jest.SpyInstance
      let warnLog: jest.SpyInstance
      const savedEnv = process.env.OPS_ALERT_EMAIL

      beforeEach(() => {
        logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
        errorLog = jest.spyOn(logger, "error")
        warnLog = jest.spyOn(logger, "warn")
        process.env.OPS_ALERT_EMAIL = OPS_EMAIL
      })

      afterEach(() => {
        jest.restoreAllMocks()
        if (savedEnv === undefined) {
          delete process.env.OPS_ALERT_EMAIL
        } else {
          process.env.OPS_ALERT_EMAIL = savedEnv
        }
      })

      const opsEmails = () => getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: OPS_EMAIL })
      const alertLogs = (code: string) => errorLog.mock.calls.filter(([msg]) => String(msg).startsWith(`${code} `))

      /** AC-33d: job อ่านอย่างเดียว — จำนวน payment/refund (รวมที่ลบ)/order ไม่เปลี่ยน */
      async function snapshot() {
        const container = getContainer()
        const payment = container.resolve(Modules.PAYMENT)
        return {
          payments: (await payment.listPayments({})).length,
          refunds: (await payment.listRefunds({}, { withDeleted: true })).length,
          orders: (await container.resolve(Modules.ORDER).listOrders({})).length,
        }
      }

      it("job config: name, every 15 minutes", () => {
        expect(config).toEqual(expect.objectContaining({ name: "refund-failure-scan", schedule: "*/15 * * * *" }))
      })

      it("(a) provider throws → refundPaymentsWorkflow swallows it (2.22.1) and leaves a soft-deleted failed refund row", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)

        const result = await failedRefund(container, paymentId)

        // ยืนยันพฤติกรรม 2.22.1 — ล้มเมื่อ bump เปลี่ยน (ADR-029 "ผลที่ตามมา")
        expect((result as { id: string }[]).map((p) => p.id)).not.toContain(paymentId)
        const payment = container.resolve(Modules.PAYMENT)
        expect(await payment.listRefunds({ payment_id: paymentId })).toHaveLength(0)
        const rows = await payment.listRefunds({ payment_id: paymentId }, { withDeleted: true })
        expect(rows).toHaveLength(1)
        expect(rows[0]).toEqual(expect.objectContaining({ status: "failed" }))
        expect((rows[0] as unknown as { deleted_at: Date | null }).deleted_at).toBeTruthy()
      })

      it("(a) failed refund → one REFUND_FAILED email + error log; running again sends and logs nothing more", async () => {
        const container = getContainer()
        const { paymentId, cartId } = await capturedCartPayment(container)
        await failedRefund(container, paymentId)
        const before = await snapshot()

        await scanRefundFailures(container)

        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0]).toEqual(expect.objectContaining({ to: OPS_EMAIL, channel: "email", template: "refund-failed" }))
        expect(emails[0].data).toEqual(
          expect.objectContaining({ code: "REFUND_FAILED", payment_id: paymentId, amount: "500", currency_code: "thb", cart_id: cartId })
        )
        const logs = alertLogs("REFUND_FAILED")
        expect(logs).toHaveLength(1)
        expect(String(logs[0][0])).toContain(`payment_id=${paymentId}`)
        expect(String(logs[0][0])).toContain(`cart_id=${cartId}`)

        await refundFailureScanJob(container)
        await scanRefundFailures(container)

        expect(await opsEmails()).toHaveLength(1)
        expect(alertLogs("REFUND_FAILED")).toHaveLength(1)
        expect(await snapshot()).toEqual(before)
      })

      it("(b) refund failed then succeeded later (provider back to normal) → no alert", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)
        await failedRefund(container, paymentId)
        const { result } = await refundPaymentsWorkflow(container).run({ input: [{ payment_id: paymentId, amount: 500 }] })
        expect((result as { id: string }[]).map((p) => p.id)).toContain(paymentId)

        await scanRefundFailures(container)

        expect(await opsEmails()).toHaveLength(0)
        expect(alertLogs("REFUND_FAILED")).toHaveLength(0)
      })

      it("(c) pending refund row: +30 minutes → nothing; +61 minutes → one REFUND_STUCK", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)
        // แถว pending = process ตายระหว่างรอ provider — สร้างด้วย createRefunds ของ Payment module (status ค่าเริ่มต้น pending)
        // (createRefunds มีใน MedusaService ของ Payment module แต่ IPaymentModuleService ไม่ประกาศ)
        const [pending] = await (container.resolve(Modules.PAYMENT) as any).createRefunds([{ payment_id: paymentId, amount: 200 }])
        expect(pending.status).toEqual("pending")
        const start = Date.now()
        const before = await snapshot()

        await scanRefundFailures(container, new Date(start + 30 * MINUTE))
        expect(await opsEmails()).toHaveLength(0)

        await scanRefundFailures(container, new Date(start + 61 * MINUTE))
        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0].data).toEqual(expect.objectContaining({ code: "REFUND_STUCK", refund_id: pending.id, payment_id: paymentId }))
        expect(alertLogs("REFUND_STUCK")).toHaveLength(1)
        expect(await snapshot()).toEqual(before)
      })

      it("(c) failed refund older than 7 days from now → nothing", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)
        await failedRefund(container, paymentId)

        await scanRefundFailures(container, new Date(Date.now() + 7 * 24 * 60 * MINUTE + MINUTE))

        expect(await opsEmails()).toHaveLength(0)
        expect(alertLogs("REFUND_FAILED")).toHaveLength(0)
      })

      it("(d) OPS_ALERT_EMAIL not set → no notification + warn (error log still written)", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)
        await failedRefund(container, paymentId)
        delete process.env.OPS_ALERT_EMAIL

        await scanRefundFailures(container)

        expect(await container.resolve(Modules.NOTIFICATION).listNotifications({})).toHaveLength(0)
        expect(alertLogs("REFUND_FAILED")).toHaveLength(1)
        expect(warnLog.mock.calls.some(([msg]) => String(msg).includes("OPS_ALERT_EMAIL is not set"))).toBe(true)
      })

      it("(d) the email provider fails once → retried next run with exactly one success email, then never again (review #550)", async () => {
        const container = getContainer()
        const { paymentId } = await capturedCartPayment(container)
        await failedRefund(container, paymentId)
        // ล้มที่ระดับ provider ของ Notification module (ไม่ใช่ createNotifications) → เกิดแถว notification `failure` จริง
        const send = jest
          .spyOn((container.resolve(Modules.NOTIFICATION) as any).notificationProviderService_, "send")
          .mockRejectedValueOnce(new Error("resend down"))

        for (let run = 0; run < 4; run++) {
          await scanRefundFailures(container)
        }

        expect(send).toHaveBeenCalledTimes(2)
        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0].status).toEqual("success")
        expect(emails[0].data).toEqual(expect.objectContaining({ payment_id: paymentId }))
        expect(alertLogs("REFUND_FAILED")).toHaveLength(2)
        expect(errorLog.mock.calls.filter(([msg]) => /send failed/.test(String(msg)))).toHaveLength(1)
      })

      it("(a) payment of an order → alert carries order_id", async () => {
        const container = getContainer()
        const payment = container.resolve(Modules.PAYMENT)
        const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount: 400 }])
        const order = await container.resolve(Modules.ORDER).createOrders({ currency_code: "thb", email: "a@x.test", items: [] })
        await container.resolve(ContainerRegistrationKeys.LINK).create({
          [Modules.ORDER]: { order_id: order.id },
          [Modules.PAYMENT]: { payment_collection_id: collection.id },
        })
        const session = await payment.createPaymentSession(collection.id, {
          provider_id: PROVIDER,
          currency_code: "thb",
          amount: 400,
          data: {},
        })
        const authorized = await payment.authorizePaymentSession(session.id, {})
        await payment.capturePayment({ payment_id: authorized!.id })
        await failedRefund(container, authorized!.id, 400)

        await scanRefundFailures(container)

        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0].data).toEqual(expect.objectContaining({ payment_id: authorized!.id, order_id: order.id, cart_id: null }))
      })

      it("(d) notification provider throws on the first of two rows → job does not throw, logs error, second row is still sent", async () => {
        const container = getContainer()
        const first = await capturedCartPayment(container)
        await failedRefund(container, first.paymentId)
        const second = await capturedCartPayment(container, 300)
        await failedRefund(container, second.paymentId, 300)
        const before = await snapshot()
        jest
          .spyOn(container.resolve(Modules.NOTIFICATION), "createNotifications")
          .mockRejectedValueOnce(new Error("resend down"))

        await expect(scanRefundFailures(container)).resolves.toBeUndefined()

        expect(errorLog.mock.calls.some(([msg]) => /OPS_ALERT_EMAIL send failed: resend down/.test(String(msg)))).toBe(true)
        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0].data).toEqual(expect.objectContaining({ payment_id: second.paymentId, amount: "300" }))
        expect(await snapshot()).toEqual(before)
      })
    })
  },
})
