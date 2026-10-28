import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { GROUP_BUY_MODULE } from "../modules/group_buy"
import type GroupBuyModuleService from "../modules/group_buy/service"
import { EmailTemplates } from "../modules/resend/templates"
import {
  confirmGroupBuyMembershipPaymentWorkflow,
  type MembershipPaymentResult,
} from "../workflows/group-buy/membership-payment"

// review #185: เงินเข้าแต่ไม่มี order ที่ใช้ได้ → ops alert ทางเดียวกับ PAY-6b (spec 06 กฎข้อ 7D, ADR-015 D)
export const GROUP_BUY_PAID_WITHOUT_ORDER = "GROUP_BUY_PAID_WITHOUT_ORDER"

type PaidWithoutOrder = {
  reason: string
  membership_id: string
  order_id: string
  payment_id: string
  amount?: string
  error?: string
}

// workflow engine คืน error ที่ serialize แล้ว (ไม่ใช่ instance ของ Error) — อ่าน message ตรงๆ
const errorMessage = (error: unknown) => (error as { message?: string } | null)?.message ?? String(error)

// log error + อีเมลหา OPS_ALERT_EMAIL (idempotency key ต่อ membership — event ซ้ำไม่ส่งซ้ำ) ไม่ทำให้ subscriber ล้ม
async function alertPaidWithoutOrder(container: MedusaContainer, alert: PaidWithoutOrder) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.error(
    `${GROUP_BUY_PAID_WITHOUT_ORDER} reason=${alert.reason} membership_id=${alert.membership_id} ` +
      `order_id=${alert.order_id} payment_id=${alert.payment_id} amount=${alert.amount} error=${alert.error ?? ""} ` +
      `— ดู runbook "group buy: เงินเข้าแต่ไม่มี order"`
  )
  const to = process.env.OPS_ALERT_EMAIL?.trim()
  if (!to) {
    logger.warn(`${GROUP_BUY_PAID_WITHOUT_ORDER}: OPS_ALERT_EMAIL is not set — skipping the ops alert email`)
    return
  }
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to,
      channel: "email",
      template: EmailTemplates.GROUP_BUY_PAID_WITHOUT_ORDER,
      data: alert,
      resource_id: alert.order_id,
      resource_type: "order",
      idempotency_key: `${EmailTemplates.GROUP_BUY_PAID_WITHOUT_ORDER}-${alert.membership_id}`,
    })
  } catch (error) {
    logger.error(`${GROUP_BUY_PAID_WITHOUT_ORDER}: OPS_ALERT_EMAIL send failed: ${errorMessage(error)}`)
  }
}

// spec 04 (GB-5): payment captured บน collection ของ draft order กลุ่ม → membership paid + แปลง order (AC-2, AC-37)
// order ที่ไม่ใช่ group buy ข้าม; workflow idempotent จึงรับ event ซ้ำได้
export default async function groupBuyPaymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { data: payments } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["id", "amount", "payment_collection.order.id"],
    filters: { id: data.id },
  })
  const orderId = payments[0]?.payment_collection?.order?.id
  if (!orderId) {
    return
  }
  const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
  const [membership] = await service.listGroupBuyMemberships({ order_id: orderId }, { select: ["id"] })
  if (!membership) {
    return
  }
  const alert = {
    membership_id: membership.id,
    order_id: orderId,
    payment_id: data.id,
    amount: payments[0]?.amount?.toString(),
  }
  const { result, errors } = (await confirmGroupBuyMembershipPaymentWorkflow(container).run({
    input: { membership_id: membership.id },
    throwOnError: false,
  })) as { result: MembershipPaymentResult; errors: { error: unknown }[] }
  if (errors.length) {
    // เช่นสต็อกหมดตอน convertDraftOrderWorkflow — membership คืน awaiting_payment, order ยังเป็น draft, ไม่มีการ retry อัตโนมัติ
    await alertPaidWithoutOrder(container, {
      ...alert,
      reason: "convert_failed",
      error: errors.map((e) => errorMessage(e.error)).join("; "),
    })
  } else if (result.action === "orphan") {
    // capture มาหลัง membership ถูกยกเลิก (เช่นพร้อมเพย์จ่ายช้ากว่า job หมดเวลา) — ไม่มี refund อัตโนมัติสำหรับ capture ที่มาหลังยกเลิก
    await alertPaidWithoutOrder(container, { ...alert, reason: `membership_${result.membership_status}` })
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
