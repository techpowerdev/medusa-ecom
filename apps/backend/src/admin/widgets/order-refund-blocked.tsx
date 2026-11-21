import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { ordersQueryKeys } from "@medusajs/dashboard/hooks"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Alert, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import { ACTIVE_ORDER_CHANGE_STATUSES, REFUND_BLOCKED_MESSAGE, pendingChangeTypes } from "../lib/order-refund-blocked"

// PAY-10 (spec 06 กฎข้อ 12, Q-P11 = ก): ปุ่ม Refund ของหน้า order เป็นของ @medusajs/dashboard (ไม่มีจุดขยายให้ปิด)
// จึงเตือนเหนือหน้า order เมื่อมี order change ค้าง — ปุ่มยังกดได้ แล้ว middleware ของ PAY-8 ตอบ 400 เป็น toast
// โหลดอยู่/โหลดล้ม → ไม่ render (เป็นคำเตือนเสริม backend กัน refund อยู่แล้ว)
// ไม่ใช้ `useOrderChanges` ของ dashboard 2.22.1: queryKey ของมันคือ `ordersQueryKeys.changes(id)` ไม่รวม query
// → ใช้ cache ร่วมกับ timeline ของหน้า order (filter change_type + field `actions`) แล้วหน้า order crash
// ("Cannot read properties of undefined (reading 'forEach')" ใน getMissingLineItemIds) — จึงต่อ key ของ dashboard
// ให้ invalidate ของ dashboard (prefix เดียวกัน เมื่อ confirm/cancel return ฯลฯ) refresh widget ด้วย
const OrderRefundBlockedWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const { data } = useQuery({
    queryKey: [...ordersQueryKeys.changes(order.id), "refund-blocked"],
    queryFn: () =>
      sdk.admin.order.listChanges(order.id, {
        status: ACTIVE_ORDER_CHANGE_STATUSES,
        fields: "id,change_type,status",
      }),
  })
  const types = pendingChangeTypes(data?.order_changes)

  if (!types.length) {
    return null
  }

  return (
    <Alert variant="warning" data-testid="order-refund-blocked">
      <Text size="small" leading="compact" weight="plus">
        {REFUND_BLOCKED_MESSAGE}
      </Text>
      <Text size="small" leading="compact" className="text-ui-fg-subtle" data-testid="order-refund-blocked-types">
        Pending: {types.join(", ")}
      </Text>
    </Alert>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderRefundBlockedWidget
