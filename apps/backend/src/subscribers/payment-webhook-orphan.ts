import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { ProviderWebhookPayload } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, PaymentActions, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { EmailTemplates } from "../modules/resend/templates"

// PAY-6b (spec 06 กฎข้อ 7D, ADR-015 D): ตาข่ายสำรอง — webhook ชำระแล้ว (captured/authorized) แต่ payment session ถูกลบไปแล้ว
// (Medusa ลบ session แบบ hard delete จึงหา payment_collection/cart ต่อไม่ได้) → เงินถูกตัดแต่ไม่มี order
// อ่านอย่างเดียว: log error + อีเมลหา OPS_ALERT_EMAIL ให้ ops ทำตาม runbook ใน docs/ops/production.md
// ไม่สร้าง payment/order/refund (ไม่ทำ reconciliation — ADR-015 ไม่เลือก B)
export const PAYMENT_WEBHOOK_SESSION_NOT_FOUND = "PAYMENT_WEBHOOK_SESSION_NOT_FOUND"

const PAID_ACTIONS: string[] = [PaymentActions.SUCCESSFUL, PaymentActions.AUTHORIZED]

type SerializedBuffer = { type: "Buffer"; data: number[] }

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export default async function paymentWebhookOrphanHandler({
  event: { data },
  container,
}: SubscriberArgs<ProviderWebhookPayload>) {
  const payment = container.resolve(Modules.PAYMENT)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // เหมือน subscriber ของ Medusa: event bus แบบ Redis serialize Buffer ของ rawData — คัดลอกก่อนแปลง ไม่แก้ event ร่วม
  const rawData = data.payload?.rawData as unknown
  const input: ProviderWebhookPayload =
    (rawData as SerializedBuffer)?.type === "Buffer"
      ? { ...data, payload: { ...data.payload, rawData: Buffer.from((rawData as SerializedBuffer).data) } }
      : data

  let processed: Awaited<ReturnType<typeof payment.getWebhookActionAndData>>
  try {
    processed = await payment.getWebhookActionAndData(input)
  } catch (error) {
    // signature เสีย / provider อ่าน event ไม่ได้ — subscriber ของ Medusa จัดการ/retry เอง ไม่ต้องให้ตัวนี้ throw ซ้ำ
    logger.warn(`payment-webhook-orphan: skipped ${input.provider} event: ${errorMessage(error)}`)
    return
  }
  const sessionId = processed.data?.session_id
  if (!sessionId || !PAID_ACTIONS.includes(processed.action)) {
    return
  }

  const sessions = await payment.listPaymentSessions({ id: sessionId }, { select: ["id"] })
  if (sessions.length) {
    return // session ยังอยู่ — subscriber ของ Medusa (processPaymentWorkflow) จัดการต่อ
  }

  // payload.data = body ของ event ที่ provider ตรวจ signature แล้วด้านบน
  const intent = (input.payload.data as { data?: { object?: { id?: string } } })?.data?.object
  const alert = {
    provider: input.provider,
    session_id: sessionId,
    amount: processed.data?.amount?.toString(),
    payment_intent: intent?.id ?? null,
  }
  logger.error(
    `${PAYMENT_WEBHOOK_SESSION_NOT_FOUND} provider=${alert.provider} session_id=${alert.session_id} ` +
      `amount=${alert.amount} payment_intent=${alert.payment_intent} — ดู runbook "เงินถูกตัดแต่ไม่มี order (ADR-015)"`
  )

  const to = process.env.OPS_ALERT_EMAIL?.trim()
  if (!to) {
    logger.warn(`${PAYMENT_WEBHOOK_SESSION_NOT_FOUND}: OPS_ALERT_EMAIL is not set — skipping the ops alert email`)
    return
  }
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to,
      channel: "email",
      template: EmailTemplates.PAYMENT_WEBHOOK_ORPHAN,
      data: alert,
      resource_id: alert.payment_intent ?? sessionId,
      resource_type: "payment_intent",
    })
  } catch (error) {
    // ห้ามทำ subscriber ล้ม (กฎข้อ 7D) — log ด้านบนยังเป็น alert อยู่
    logger.error(`${PAYMENT_WEBHOOK_SESSION_NOT_FOUND}: OPS_ALERT_EMAIL send failed: ${errorMessage(error)}`)
  }
}

export const config: SubscriberConfig = {
  event: PaymentWebhookEvents.WebhookReceived,
  context: {
    subscriberId: "payment-webhook-orphan",
  },
}
