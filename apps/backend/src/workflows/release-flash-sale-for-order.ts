import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { isOrderFullyRefunded } from "../lib/flash-sale-release"
import {
  releaseFlashSaleReservationsStep,
  type ReleaseFlashSaleReservationsStepInput,
} from "./steps/release-flash-sale-reservations"

export type ReleaseFlashSaleForOrderInput = {
  order_id: string
  // "canceled" คืนเสมอ; "refunded" คืนเฉพาะเมื่อ refund เต็มจำนวนแล้ว (spec 03 กฎข้อ 10)
  reason: "canceled" | "refunded"
}

// FS-2 (spec 03 "FS-2 คืนค่า"): หา cart ของ order ผ่าน link order.cart แล้วคืน usage + units_sold ตาม reservation
export const releaseFlashSaleForOrderWorkflow = createWorkflow(
  "release-flash-sale-for-order",
  (input: ReleaseFlashSaleForOrderInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "cart.id",
        "payment_collections.payments.captures.raw_amount",
        "payment_collections.payments.refunds.raw_amount",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })

    // cart_id ว่าง = ไม่ต้องคืน (ไม่มี cart หรือ refund ยังไม่เต็มจำนวน)
    const release = transform({ orders, input }, ({ orders, input }): ReleaseFlashSaleReservationsStepInput => {
      const order = orders[0]
      if (input.reason === "refunded" && !isOrderFullyRefunded(order)) {
        return { cart_id: "" }
      }
      return { cart_id: order.cart?.id ?? "" }
    })

    const released = when({ release }, ({ release }) => !!release.cart_id).then(() =>
      releaseFlashSaleReservationsStep(release)
    )

    return new WorkflowResponse({ released })
  }
)
