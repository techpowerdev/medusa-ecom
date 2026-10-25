import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { isOrderFullyRefunded } from "../lib/flash-sale-release"
import { releaseFlashSaleReservationsStep } from "./steps/release-flash-sale-reservations"

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
        "payment_collections.payments.captures.amount",
        "payment_collections.payments.refunds.amount",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })

    const cartId = transform({ orders, input }, ({ orders, input }): string | null => {
      const order = orders[0]
      if (input.reason === "refunded" && !isOrderFullyRefunded(order)) {
        return null
      }
      return order.cart?.id ?? null
    })

    const released = when({ cartId }, ({ cartId }) => !!cartId).then(() =>
      releaseFlashSaleReservationsStep({ cart_id: cartId as unknown as string })
    )

    return new WorkflowResponse({ released })
  }
)
