import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import paymentWebhookOrphanHandler, { config } from "../../src/subscribers/payment-webhook-orphan"

jest.setTimeout(60 * 1000)

// PAY-6b: spec 06 กฎข้อ 7D / AC-15 (ADR-015 D) — webhook ที่ชำระแล้วแต่หา payment session ไม่เจอ → log + อีเมล ops
// signature ของ webhook ถูกตรวจจริงโดย Stripe provider ของ Medusa (STRIPE_WEBHOOK_SECRET จาก integration-tests/setup.js)
const stripeSdkPath = require.resolve("stripe", {
  paths: [
    path.dirname(
      require.resolve("@medusajs/payment-stripe/package.json", {
        paths: [require.resolve("@medusajs/medusa/package.json")],
      })
    ),
  ],
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require(stripeSdkPath)

const OPS_EMAIL = "ops@x.test"
const PROVIDER = "stripe-promptpay_stripe"
const INTENT_ID = "pi_pay6b_orphan"

type EventData = { provider: string; payload: Record<string, unknown> }

/** event data แบบเดียวกับที่ route `/hooks/payment/:provider` ของ Medusa emit (rawData เป็น Buffer) */
function webhookEvent(type: string, sessionId: string, serialized = false): EventData {
  const body = {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: {
      object: {
        id: INTENT_ID,
        object: "payment_intent",
        amount: 50000,
        amount_received: 50000,
        amount_capturable: 50000,
        currency: "thb",
        status: "succeeded",
        metadata: { session_id: sessionId },
      },
    },
  }
  const payload = JSON.stringify(body)
  const signature = new Stripe("sk_test_signing_only").webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  const raw = Buffer.from(payload)
  return {
    provider: PROVIDER,
    payload: {
      data: body,
      // event bus แบบ Redis serialize Buffer เป็น { type: "Buffer", data: [...] }
      rawData: serialized ? raw.toJSON() : raw,
      headers: { "content-type": "application/json", "stripe-signature": signature },
    },
  }
}

const run = (container: MedusaContainer, data: EventData) =>
  paymentWebhookOrphanHandler({
    event: { name: PaymentWebhookEvents.WebhookReceived, data },
    container,
    pluginOptions: {},
  } as any)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("subscriber payment-webhook-orphan (AC-15)", () => {
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

      const opsEmails = () =>
        getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: OPS_EMAIL })

      const orphanLogs = () =>
        errorLog.mock.calls.filter(([msg]) => String(msg).startsWith("PAYMENT_WEBHOOK_SESSION_NOT_FOUND provider="))

      async function expectNothingCreated() {
        const container = getContainer()
        const payment = container.resolve(Modules.PAYMENT)
        expect(await payment.listPayments({})).toHaveLength(0)
        expect(await payment.listRefunds({})).toHaveLength(0)
        expect(await container.resolve(Modules.ORDER).listOrders({})).toHaveLength(0)
      }

      it("listens to payment.webhook_received with its own subscriberId", () => {
        expect(config.event).toEqual(PaymentWebhookEvents.WebhookReceived)
        expect(config.context?.subscriberId).toEqual("payment-webhook-orphan")
      })

      it.each([
        { type: "payment_intent.succeeded", serialized: false },
        { type: "payment_intent.amount_capturable_updated", serialized: true },
      ])("session not found ($type) → error log + one email to OPS_ALERT_EMAIL with the PI id", async ({ type, serialized }) => {
        await run(getContainer(), webhookEvent(type, "payses_missing", serialized))

        const logs = orphanLogs()
        expect(logs).toHaveLength(1)
        const line = String(logs[0][0])
        expect(line).toContain(`provider=${PROVIDER}`)
        expect(line).toContain("session_id=payses_missing")
        expect(line).toContain("amount=500")
        expect(line).toContain(`payment_intent=${INTENT_ID}`)

        const emails = await opsEmails()
        expect(emails).toHaveLength(1)
        expect(emails[0]).toEqual(
          expect.objectContaining({ to: OPS_EMAIL, channel: "email", template: "payment-webhook-orphan" })
        )
        expect(JSON.stringify(emails[0].data)).toContain(INTENT_ID)
        await expectNothingCreated()
      })

      it("session exists → no log and no email", async () => {
        const payment = getContainer().resolve(Modules.PAYMENT)
        const [collection] = await payment.createPaymentCollections([{ currency_code: "thb", amount: 500 }])
        const session = await payment.createPaymentSession(collection.id, {
          provider_id: "pp_system_default",
          currency_code: "thb",
          amount: 500,
          data: {},
        })

        await run(getContainer(), webhookEvent("payment_intent.succeeded", session.id))

        expect(orphanLogs()).toHaveLength(0)
        expect(await opsEmails()).toHaveLength(0)
      })

      it("not a captured/authorized action → no log and no email", async () => {
        await run(getContainer(), webhookEvent("payment_intent.canceled", "payses_missing"))

        expect(orphanLogs()).toHaveLength(0)
        expect(await opsEmails()).toHaveLength(0)
      })

      it("OPS_ALERT_EMAIL not set → error log, warn log, no notification", async () => {
        delete process.env.OPS_ALERT_EMAIL

        await run(getContainer(), webhookEvent("payment_intent.succeeded", "payses_missing"))

        expect(orphanLogs()).toHaveLength(1)
        expect(warnLog.mock.calls.some(([msg]) => String(msg).includes("OPS_ALERT_EMAIL"))).toBe(true)
        expect(await getContainer().resolve(Modules.NOTIFICATION).listNotifications({})).toHaveLength(0)
        await expectNothingCreated()
      })

      it("notification provider throws → subscriber does not throw and logs an error", async () => {
        jest
          .spyOn(getContainer().resolve(Modules.NOTIFICATION), "createNotifications")
          .mockRejectedValue(new Error("resend down"))

        await expect(run(getContainer(), webhookEvent("payment_intent.succeeded", "payses_missing"))).resolves.toBeUndefined()

        expect(orphanLogs()).toHaveLength(1)
        expect(errorLog.mock.calls.some(([msg]) => /OPS_ALERT_EMAIL.*resend down/.test(String(msg)))).toBe(true)
        await expectNothingCreated()
      })
    })
  },
})
