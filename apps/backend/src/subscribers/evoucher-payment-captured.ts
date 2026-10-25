import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { allocateAndDeliverEvouchersWorkflow } from "../workflows/evoucher/allocate-and-deliver-evouchers"

// EV-4 (spec 02 กฎข้อ 2): allocate + ส่งมอบ e-voucher หลังชำระเงิน captured — รันใน worker ไม่ใช่ใน request ของ checkout
export default async function evoucherPaymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection.order.id"],
    filters: { id: data.id },
  })
  const orderId = payments[0]?.payment_collection?.order?.id
  if (!orderId) {
    return
  }

  await allocateAndDeliverEvouchersWorkflow(container).run({
    input: {
      order_id: orderId,
      // กฎข้อ 9: mailbox เดียวจาก env (owner Q-A)
      admin_email: process.env.EVOUCHER_ADMIN_EMAIL?.trim() || undefined,
    },
  })
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
