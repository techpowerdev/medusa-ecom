import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { releaseEvoucherCodesForOrderWorkflow } from "../workflows/evoucher/release-evoucher-codes-for-order"
import { shortError } from "../modules/evoucher/utils/short-error"

// EV-16 (spec 02 กฎข้อ 32): order ถูกยกเลิก → ปล่อย code `allocated` ที่ยังไม่ส่งมอบกลับเป็น `available`
// ส่งแค่ order_id จาก event; ล้ม (เช่นรอ lock ไม่ได้) → log error ไม่มี retry (แบบ EV-4, กฎข้อ 32b)
export default async function evoucherOrderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: data.id } })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      // error จาก workflow.run() ไม่ใช่ instanceof Error — ใช้ message ของ object (ไม่ log เป็น [object Object])
      .error(`evoucher: releasing allocated codes of canceled order ${data.id} failed: ${shortError(error)}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
