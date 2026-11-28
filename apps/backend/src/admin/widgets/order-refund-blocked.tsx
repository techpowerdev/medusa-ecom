import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useOrderPreview } from "@medusajs/dashboard/hooks"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Alert, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { activeChangeType, refundBlockedMessage } from "../lib/order-refund-blocked"

// PAY-10 (spec 06 กฎข้อ 12, Q-P11 = ก): ปุ่ม Refund ของหน้า order เป็นของ @medusajs/dashboard (ไม่มีจุดขยายให้ปิด)
// จึงเตือนบนหน้า order เมื่อมี order change ค้าง — ปุ่มยังกดได้ แล้ว middleware ของ PAY-8 ตอบ 400 เป็น toast
// `useOrderPreview(id)` เรียกแบบเดียวกับหน้า order ของ Medusa (ห้ามส่ง query — key `preview(id)` ไม่รวม query) จึงใช้ cache ร่วมกัน
// ไม่มี request เพิ่ม และ mutation ของ return/claim/exchange/edit ทุกตัว invalidate `preview(id)` → widget ขึ้น/หายเองโดยไม่ reload
// (`useOrderChanges` ใช้ไม่ได้: key ไม่รวม query → cache ชนกับ timeline จนหน้า crash และ mutation เหล่านี้ไม่ invalidate key นั้น)
// `order_change` ของ preview = active change ที่ order module หาด้วย status pending/requested = เงื่อนไขของ guard PAY-8
// โหลดอยู่/โหลดล้ม → ไม่ render (เป็นคำเตือนเสริม backend กัน refund อยู่แล้ว)
const OrderRefundBlockedWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  // spec 10: useTranslation ให้ widget render ใหม่เมื่อเปลี่ยนภาษา (ข้อความจาก lib แปลตอนเรียก)
  const { t } = useTranslation("ecom-evoucher")
  const { order: preview } = useOrderPreview(order.id)
  const type = activeChangeType(preview?.order_change)

  if (!type) {
    return null
  }

  return (
    <Alert variant="warning" data-testid="order-refund-blocked">
      <Text size="small" leading="compact" weight="plus">
        {refundBlockedMessage()}
      </Text>
      <Text size="small" leading="compact" className="text-ui-fg-subtle" data-testid="order-refund-blocked-types">
        {t("refundBlocked.pending", { type })}
      </Text>
    </Alert>
  )
}

// `id` = key ของ widget ใน layout configuration (src/lib/order-refund-blocked-layout.ts) — admin-vite-plugin อ่านเฉพาะ string literal
// dashboard 2.22.1 ไม่สนใจ `.before` (วางต่อท้ายคอลัมน์หลัก) ตำแหน่งบนสุดมาจาก default layout ที่ migration script ตั้งไว้
export const config = defineWidgetConfig({ id: "order-refund-blocked", zone: "order.details.before" })

export default OrderRefundBlockedWidget
