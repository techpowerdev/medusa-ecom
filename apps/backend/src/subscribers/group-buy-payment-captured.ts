import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GROUP_BUY_MODULE } from "../modules/group_buy"
import type GroupBuyModuleService from "../modules/group_buy/service"
import { confirmGroupBuyMembershipPaymentWorkflow } from "../workflows/group-buy/membership-payment"

// spec 04 (GB-5): payment captured บน collection ของ draft order กลุ่ม → membership paid + แปลง order (AC-2, AC-37)
// order ที่ไม่ใช่ group buy ข้าม; workflow idempotent จึงรับ event ซ้ำได้
export default async function groupBuyPaymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { data: payments } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["id", "payment_collection.order.id"],
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
  await confirmGroupBuyMembershipPaymentWorkflow(container).run({ input: { membership_id: membership.id } })
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
