import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { ProviderWebhookPayload } from "@medusajs/framework/types"
import {
  BigNumber,
  ContainerRegistrationKeys,
  defaultCurrencies,
  MathBN,
  Modules,
  PaymentWebhookEvents,
} from "@medusajs/framework/utils"
import { sendOpsAlert } from "../lib/ops-alert"
import { EmailTemplates } from "../modules/resend/templates"

// PAY-21 (spec 06 กฎข้อ 23, ADR-029 ข): Stripe แจ้งว่า refund ที่รับไปแล้วล้มภายหลัง (`refund.failed`/`refund.updated`)
// Medusa 2.22.1 คืน `not_supported` กับ event เหล่านี้ (ไม่มี `metadata.session_id`) — ตัวนี้อ่าน body ที่ provider ตรวจ signature แล้ว
// แล้วแจ้ง ops เท่านั้น: ไม่เขียน DB, ไม่ import stripe, ไม่ throw (Medusa ยังนับว่าคืนแล้ว — ops ทำตาม runbook, Q-P19 = ก)
export const STRIPE_REFUND_FAILED = "STRIPE_REFUND_FAILED"

const REFUND_EVENTS = ["refund.failed", "refund.updated"]
const FAILED_STATUSES = ["failed", "canceled"]

type SerializedBuffer = { type: "Buffer"; data: number[] }
type StripeRefund = {
  id?: string
  amount?: number
  currency?: string
  status?: string
  payment_intent?: string | null
  failure_reason?: string | null
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** หน่วยย่อยของ Stripe → หน่วยหลักตามทศนิยมของสกุลเงิน (81000 satang → 810 THB) */
const fromSmallestUnit = (amount: number, currency: string) => {
  const digits = defaultCurrencies[currency.toUpperCase()]?.decimal_digits ?? 2
  return new BigNumber(MathBN.div(amount, 10 ** digits)).numeric
}

export default async function stripeRefundWebhookHandler({
  event: { data },
  container,
}: SubscriberArgs<ProviderWebhookPayload>) {
  const body = data.payload?.data as { type?: string; data?: { object?: StripeRefund } } | undefined
  if (!data.provider?.startsWith("stripe") || !REFUND_EVENTS.includes(body?.type ?? "")) {
    return
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const payment = container.resolve(Modules.PAYMENT)

  // เหมือน payment-webhook-orphan: event bus แบบ Redis serialize Buffer ของ rawData — คัดลอกก่อนแปลง ไม่แก้ event ร่วม
  const rawData = data.payload.rawData as unknown
  const input: ProviderWebhookPayload =
    (rawData as SerializedBuffer)?.type === "Buffer"
      ? { ...data, payload: { ...data.payload, rawData: Buffer.from((rawData as SerializedBuffer).data) } }
      : data

  try {
    // ตรวจ signature เท่านั้น (ผลเป็น not_supported เสมอใน 2.22.1) — signature ผิดต้องไม่ alert
    await payment.getWebhookActionAndData(input)
  } catch (error) {
    logger.warn(`stripe-refund-webhook: skipped ${input.provider} event: ${errorMessage(error)}`)
    return
  }

  const refund = body?.data?.object
  if (!refund?.id || !FAILED_STATUSES.includes(refund.status ?? "")) {
    return
  }
  const key = `stripe-refund-failed:${refund.id}`
  const currency = refund.currency ?? ""
  const alert = () =>
    sendOpsAlert(container, {
      code: STRIPE_REFUND_FAILED,
      template: EmailTemplates.REFUND_FAILED,
      idempotency_key: key,
      resource_type: "payment_intent",
      resource_id: refund.payment_intent ?? refund.id!,
      data: {
        refund_id: refund.id,
        payment_intent: refund.payment_intent ?? null,
        amount: refund.amount === undefined ? null : fromSmallestUnit(refund.amount, currency || "thb"),
        currency,
        status: refund.status,
        failure_reason: refund.failure_reason ?? null,
      },
    })
  try {
    // Stripe ส่ง refund.updated กับ refund.failed ของ refund เดียวกันพร้อมกัน — lock ต่อ refund ให้ตัวหลังเห็นแถวของตัวแรก
    await container.resolve(Modules.LOCKING).execute(key, alert, { timeout: 30 })
  } catch (error) {
    logger.error(`${STRIPE_REFUND_FAILED}: stripe-refund-webhook failed for ${refund.id}: ${errorMessage(error)}`)
  }
}

export const config: SubscriberConfig = {
  event: PaymentWebhookEvents.WebhookReceived,
  context: {
    subscriberId: "stripe-refund-webhook",
  },
}
