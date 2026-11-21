import type { LayoutWidgetPreference } from "@medusajs/framework/types"

// PAY-10 (spec 06 กฎข้อ 12, qa #471 D-2): dashboard 2.22.1 ทิ้ง suffix `.before` ของ zone (`getWidgetsForSections`) แล้ววาง widget
// ต่อท้ายคอลัมน์หลักของหน้า order (ใต้ Payments) — ตำแหน่งปรับได้ทางเดียวที่ Medusa รองรับคือ layout configuration ของ zone
// (ปุ่ม "Customize layout"; system default ใช้กับแอดมินที่ยังไม่บันทึก layout ของตัวเอง) — entry ที่ไม่มี order = 0 จึงใช้ -1 ให้ขึ้นก่อน
export const ORDER_DETAILS_LAYOUT_ZONE = "order.details"
// `widget:` + `id` ใน defineWidgetConfig ของ src/admin/widgets/order-refund-blocked.tsx
export const REFUND_BLOCKED_WIDGET_LAYOUT_KEY = "widget:order-refund-blocked"

type Widgets = Record<string, LayoutWidgetPreference>

/** widgets ของ default layout ที่ใส่ widget ไว้บนสุด; null = แอดมินกำหนดตำแหน่งของ widget นี้ไว้แล้ว (ไม่ทับ) */
export function withRefundBlockedWidgetFirst(widgets: Widgets | undefined | null): Widgets | null {
  if (widgets?.[REFUND_BLOCKED_WIDGET_LAYOUT_KEY]) {
    return null
  }
  return { ...widgets, [REFUND_BLOCKED_WIDGET_LAYOUT_KEY]: { order: -1 } }
}
