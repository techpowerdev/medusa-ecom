import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { releaseFlashSaleForOrderWorkflow } from "../workflows/release-flash-sale-for-order"

// FS-2 (spec 03 กฎข้อ 10): order.canceled หรือ refund เต็มจำนวน → คืนสิทธิ์ flash ตาม reservation ของ order
// ไม่มี subscriber บน order.placed — การนับเกิดตอน complete cart แล้ว (FS-3)
// FS-11 (กฎข้อ 16): ส่งแค่ id จาก event เข้า workflow — payment.refunded ส่ง { id: payment_id } การหา order จาก
// payment และเกณฑ์ refund เต็มจำนวนอยู่ใน step ของ workflow จึงได้ retry ของ FS-8
export default async function flashSaleReleaseHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const input =
    name === "order.canceled"
      ? { order_id: data.id, reason: "canceled" as const }
      : { payment_id: data.id, reason: "refunded" as const }

  await releaseFlashSaleForOrderWorkflow(container).run({ input })
}

export const config: SubscriberConfig = {
  event: ["order.canceled", "payment.refunded"],
}
