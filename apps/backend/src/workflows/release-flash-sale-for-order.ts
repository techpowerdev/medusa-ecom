import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { isOrderFullyRefunded } from "../lib/flash-sale-release"
import {
  releaseFlashSaleReservationsStep,
  type ReleaseFlashSaleReservationsStepInput,
} from "./steps/release-flash-sale-reservations"

// "canceled" คืนเสมอ; "refunded" (ทุกที่มา: cancel, return, คืนด้วยมือ) คืนเมื่อ refund รวม >= capture รวม (spec 03 กฎข้อ 10)
// FS-11 (กฎข้อ 16): refund รับ payment_id จาก event payment.refunded ตรงๆ — การหา order อยู่ใน step จึงได้ retry ด้วย
export type ReleaseFlashSaleForOrderInput =
  | { order_id: string; reason: "canceled" }
  | { payment_id: string; reason: "refunded" }

// FS-8 (AC-14): step ที่ล้ม (เช่น DB ขาดชั่วคราว) ถูก workflow engine ของ Medusa ลองใหม่ทุก 10 วินาที สูงสุด 30 ครั้ง
// (~5 นาที) — retryInterval ทำให้ workflow ถูกเก็บ (store) และ engine Redis ของ prod ตั้งเวลา retry ผ่าน queue จึงไม่หาย
// แม้ process ที่รัน subscriber ล้ม; การคืนยัง idempotent ด้วย released_at (retry หลังสำเร็จไม่คืนซ้ำ)
export const RELEASE_RETRY = { maxRetries: 30, retryInterval: 10 }

// FS-2 (spec 03 "FS-2 คืนค่า"): หา cart ของ order ผ่าน link order.cart แล้วคืน usage + units_sold ตาม reservation
export const releaseFlashSaleForOrderWorkflow = createWorkflow(
  "release-flash-sale-for-order",
  (input: ReleaseFlashSaleForOrderInput) => {
    const paymentId = transform({ input }, ({ input }) => ("payment_id" in input ? input.payment_id : ""))

    const payments = when({ paymentId }, ({ paymentId }) => !!paymentId).then(() => {
      const { data } = useQueryGraphStep({
        entity: "payment",
        fields: ["id", "payment_collection.order.id"],
        filters: { id: paymentId },
      }).config({
        name: "find-order-of-refunded-payment",
        maxRetries: RELEASE_RETRY.maxRetries,
        retryInterval: RELEASE_RETRY.retryInterval,
      })
      return data
    })

    // order_id ว่าง = payment ไม่ผูกกับ order (ไม่ต้องคืน)
    const orderId = transform({ input, payments }, ({ input, payments }) =>
      "order_id" in input ? input.order_id : (payments?.[0]?.payment_collection?.order?.id ?? "")
    )

    const orders = when({ orderId }, ({ orderId }) => !!orderId).then(() => {
      const { data } = useQueryGraphStep({
        entity: "order",
        fields: [
          "id",
          "cart.id",
          "payment_collections.payments.captures.raw_amount",
          "payment_collections.payments.refunds.raw_amount",
        ],
        filters: { id: orderId },
        options: { throwIfKeyNotFound: true },
      }).config(RELEASE_RETRY)
      return data
    })

    // cart_id ว่าง = ไม่ต้องคืน (ไม่มี cart หรือ refund ยังไม่เต็มจำนวน)
    const release = transform({ orders, input }, ({ orders, input }): ReleaseFlashSaleReservationsStepInput => {
      const order = orders?.[0]
      if (!order) {
        return { cart_id: "" }
      }
      if (input.reason === "refunded" && !isOrderFullyRefunded(order)) {
        return { cart_id: "" }
      }
      return { cart_id: order.cart?.id ?? "" }
    })

    const released = when({ release }, ({ release }) => !!release.cart_id).then(() =>
      releaseFlashSaleReservationsStep(release).config(RELEASE_RETRY)
    )

    return new WorkflowResponse({ released })
  }
)
