import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  reverseAffiliateCommissionWorkflow,
  ReverseAffiliateCommissionInput,
} from "../workflows/affiliate/reverse-commission"

// AF-4 (spec 05): refund/cancel/return → entry `reversed` สำหรับยอดที่ได้รับผลกระทบ (ไม่แก้ entry เดิม)
// payment.refunded ส่ง { id: payment_id }, order.return_received ส่ง { order_id, return_id }
export default async function affiliateReversalHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id?: string; order_id?: string }>) {
  const input: ReverseAffiliateCommissionInput =
    name === "payment.refunded"
      ? { payment_id: data.id!, reason: "refunded" }
      : name === "order.return_received"
        ? { order_id: data.order_id!, reason: "returned" }
        : { order_id: data.id!, reason: "canceled" }

  await reverseAffiliateCommissionWorkflow(container).run({ input })
}

export const config: SubscriberConfig = {
  event: ["order.canceled", "payment.refunded", "order.return_received"],
}
