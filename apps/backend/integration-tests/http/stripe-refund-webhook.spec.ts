import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import stripeRefundWebhookHandler, { config } from "../../src/subscribers/stripe-refund-webhook"

jest.setTimeout(120 * 1000)

// PAY-21: spec 06 กฎข้อ 23 / AC-34a–c (ADR-029 ข) — Stripe แจ้ง refund ล้มภายหลัง (`refund.failed`/`refund.updated`)
// ผ่าน webhook endpoint เดียว (ADR-023) → subscriber stripe-refund-webhook แจ้ง ops `STRIPE_REFUND_FAILED`
// signature ถูกตรวจจริงโดย Stripe provider ของ Medusa (STRIPE_WEBHOOK_SECRET จาก integration-tests/setup.js) ไม่ออก network
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
const HOOK = "/hooks/payment/stripe_stripe"
const TEMPLATE = "refund-failed"

// idempotency_key เป็น column ของ notification แต่ NotificationDTO ของ 2.22.1 ไม่ประกาศ
const keyOf = (n: object) => (n as { idempotency_key?: string }).idempotency_key

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Refund = { id: string; status: string; amount?: number; failure_reason?: string | null }

function refundEvent(type: string, refund: Refund) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: {
      object: {
        object: "refund",
        amount: 81000,
        currency: "thb",
        payment_intent: "pi_x",
        failure_reason: null,
        metadata: {},
        ...refund,
      },
    },
  }
}

function intentEvent(sessionId: string) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_pay21_normal",
        object: "payment_intent",
        amount: 50000,
        amount_received: 50000,
        currency: "thb",
        status: "succeeded",
        metadata: { session_id: sessionId },
      },
    },
  }
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("subscriber stripe-refund-webhook (AC-34)", () => {
      let errorLog: jest.SpyInstance
      let warnLog: jest.SpyInstance
      const savedEnv = process.env.OPS_ALERT_EMAIL

      beforeEach(() => {
        const logger: Logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
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

      /** POST แบบ Stripe (body ดิบ + header stripe-signature) — ห่อ error ของ axios (CLAUDE.md) */
      async function deliver(event: Record<string, unknown>, signature?: string) {
        const payload = JSON.stringify(event)
        const header =
          signature ??
          new Stripe("sk_test_signing_only").webhooks.generateTestHeaderString({
            payload,
            secret: process.env.STRIPE_WEBHOOK_SECRET,
          })
        try {
          const res = await api.post(HOOK, payload, {
            headers: { "content-type": "application/json", "stripe-signature": header },
          })
          expect(res.status).toEqual(200)
        } catch (e: any) {
          throw new Error(`${e.response?.status} ${JSON.stringify(e.response?.data)}`)
        }
      }

      /** เรียก subscriber ตรง (event data แบบที่ route emit: rawData เป็น Buffer ที่ serialize แล้ว) */
      function runHandler(type: string, refundId: string) {
        const body = refundEvent(type, { id: refundId, status: "failed" })
        const payload = JSON.stringify(body)
        const signature = new Stripe("sk_test_signing_only").webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        })
        return stripeRefundWebhookHandler({
          event: {
            name: PaymentWebhookEvents.WebhookReceived,
            data: {
              provider: "stripe_stripe",
              payload: { data: body, rawData: Buffer.from(payload).toJSON(), headers: { "stripe-signature": signature } },
            },
          },
          container: getContainer(),
          pluginOptions: {},
        } as any)
      }

      const notifications = () => getContainer().resolve(Modules.NOTIFICATION).listNotifications({})
      const refundAlerts = async () => (await notifications()).filter((n) => n.template === TEMPLATE)
      const alertLogs = () => errorLog.mock.calls.filter(([msg]) => String(msg).startsWith("STRIPE_REFUND_FAILED "))

      /** route ของ Medusa หน่วง event 5 วินาที (webhook_delay) — รอจนเงื่อนไขเป็นจริง */
      async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 30000) {
        const until = Date.now() + timeoutMs
        while (Date.now() < until) {
          if (await check()) {
            return
          }
          await sleep(250)
        }
        throw new Error("timed out waiting for the webhook event to be processed")
      }

      async function expectNothingCreated() {
        const container = getContainer()
        const payment = container.resolve(Modules.PAYMENT)
        expect(await payment.listPayments({})).toHaveLength(0)
        expect(await payment.listRefunds({}, { withDeleted: true })).toHaveLength(0)
        expect(await container.resolve(Modules.ORDER).listOrders({})).toHaveLength(0)
      }

      it("listens to payment.webhook_received with its own subscriberId", () => {
        expect(config.event).toEqual(PaymentWebhookEvents.WebhookReceived)
        expect(config.context?.subscriberId).toEqual("stripe-refund-webhook")
      })

      it("(a) refund.failed → one email with amount in baht; repeats and refund.updated failed of the same refund → still one", async () => {
        const failed = refundEvent("refund.failed", { id: "re_x", status: "failed", failure_reason: "lost_or_stolen_card" })
        await deliver(failed)
        await waitFor(async () => (await refundAlerts()).length > 0)

        const [email] = await refundAlerts()
        expect(email).toEqual(
          expect.objectContaining({
            to: OPS_EMAIL,
            channel: "email",
            idempotency_key: "stripe-refund-failed:re_x",
            resource_id: "pi_x",
          })
        )
        expect(email.data).toEqual(
          expect.objectContaining({
            code: "STRIPE_REFUND_FAILED",
            source: "stripe",
            refund_id: "re_x",
            payment_intent: "pi_x",
            amount: 810,
            currency: "thb",
            status: "failed",
            failure_reason: "lost_or_stolen_card",
          })
        )
        expect(alertLogs()).toHaveLength(1)
        expect(String(alertLogs()[0][0])).toContain("refund_id=re_x")

        // Stripe ส่ง event เดิมซ้ำ + refund.updated ของ refund เดียวกันมาพร้อมกัน
        const updated = refundEvent("refund.updated", { id: "re_x", status: "failed", failure_reason: "lost_or_stolen_card" })
        await Promise.all([deliver(failed), deliver(updated)])
        // พร้อมกันต้องไม่ชน unique idempotency_key จนเกิด log "send failed" (subscriber ถือ lock ต่อ refund)
        const noise = () =>
          errorLog.mock.calls.filter(([msg]) => /send failed/.test(String(msg))).length +
          warnLog.mock.calls.filter(([msg]) => /stripe-refund-webhook/.test(String(msg))).length
        // event ที่ซ้ำไม่ log — รอ positive control (refund อื่น) แทนการเดาเวลา
        await deliver(refundEvent("refund.failed", { id: "re_control", status: "failed" }))
        await waitFor(async () => (await refundAlerts()).length > 1)
        await sleep(1000)

        const alerts = await refundAlerts()
        expect(alerts.filter((n) => keyOf(n) === "stripe-refund-failed:re_x")).toHaveLength(1)
        expect(alerts).toHaveLength(2)
        expect(alertLogs().filter(([msg]) => String(msg).includes("refund_id=re_x"))).toHaveLength(1)
        expect(noise()).toEqual(0)
        await expectNothingCreated()
      })

      it("(a) refund.failed and refund.updated of one refund processed concurrently (Redis event bus) → one email, no send-failure log", async () => {
        // เรียก subscriber ตรงพร้อมกันสองตัว (event data แบบที่ route emit: rawData เป็น Buffer) — จำลอง worker ของ event bus แบบ Redis
        const run = (type: string) => runHandler(type, "re_z")

        await Promise.all([run("refund.failed"), run("refund.updated"), run("refund.failed")])

        const alerts = await refundAlerts()
        expect(alerts.map(keyOf)).toEqual(["stripe-refund-failed:re_z"])
        expect(alertLogs()).toHaveLength(1)
        expect(errorLog.mock.calls.filter(([msg]) => /send failed|stripe-refund-webhook: alert failed/.test(String(msg)))).toHaveLength(0)
      })

      it("(PAY-23, AC-36) locking throws → error log does not start with STRIPE_REFUND_FAILED (reserved for real alerts)", async () => {
        jest.spyOn(getContainer().resolve(Modules.LOCKING), "execute").mockRejectedValueOnce(new Error("lock timeout"))

        await runHandler("refund.failed", "re_lock")

        const lines = errorLog.mock.calls.map(([msg]) => String(msg))
        expect(lines.filter((line) => line.startsWith("STRIPE_REFUND_FAILED"))).toEqual([])
        expect(lines.filter((line) => line.startsWith("stripe-refund-webhook: alert failed"))).toEqual([
          expect.stringContaining("re_lock"),
        ])
        expect(await refundAlerts()).toHaveLength(0)
      })

      it("(b) refund.updated canceled → one email; requires_action/pending/succeeded → none", async () => {
        await Promise.all(
          ["requires_action", "pending", "succeeded"].map((status) =>
            deliver(refundEvent("refund.updated", { id: `re_${status}`, status }))
          )
        )
        await deliver(refundEvent("refund.updated", { id: "re_y", status: "canceled" }))
        await waitFor(async () => (await refundAlerts()).length > 0)
        await sleep(1000)

        const alerts = await refundAlerts()
        expect(alerts).toHaveLength(1)
        expect(keyOf(alerts[0])).toEqual("stripe-refund-failed:re_y")
        expect(alerts[0].data).toEqual(expect.objectContaining({ status: "canceled", amount: 810 }))
        expect(alertLogs()).toHaveLength(1)
        await expectNothingCreated()
      })

      it("(c) invalid signature → warn, no alert", async () => {
        const event = refundEvent("refund.failed", { id: "re_forged", status: "failed" })
        await deliver(event, "t=1,v1=forged")
        await waitFor(() => warnLog.mock.calls.some(([msg]) => String(msg).startsWith("stripe-refund-webhook: skipped")))
        await sleep(1000)

        expect(await notifications()).toHaveLength(0)
        expect(alertLogs()).toHaveLength(0)
        await expectNothingCreated()
      })

      it("(c) payment_intent.succeeded → this subscriber sends nothing (orphan alert proves the event was processed)", async () => {
        await deliver(intentEvent("payses_pay21_missing"))
        await waitFor(async () => (await notifications()).length > 0)
        await sleep(1000)

        const all = await notifications()
        expect(all.map((n) => n.template)).toEqual(["payment-webhook-orphan"])
        expect(await refundAlerts()).toHaveLength(0)
        expect(alertLogs()).toHaveLength(0)
        await expectNothingCreated()
      })
    })
  },
})
