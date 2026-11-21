import fs from "node:fs"
import path from "node:path"

import { ACTIVE_ORDER_CHANGE_STATUSES as GUARD_STATUSES } from "../../../lib/active-order-change"
import { ACTIVE_ORDER_CHANGE_REFUND_MESSAGE } from "../../../api/admin/payments/middlewares"
import {
  ORDER_DETAILS_LAYOUT_ZONE,
  REFUND_BLOCKED_WIDGET_LAYOUT_KEY,
  withRefundBlockedWidgetFirst,
} from "../../../lib/order-refund-blocked-layout"
import { ACTIVE_ORDER_CHANGE_STATUSES, REFUND_BLOCKED_MESSAGE, activeChangeType } from "../order-refund-blocked"

// PAY-10 (spec 06 กฎข้อ 12): widget ต้องเตือนด้วยเงื่อนไขเดียวกับ middleware ของ PAY-8 (กฎข้อ 10b)
describe("order refund blocked widget", () => {
  it("uses the same active statuses as the PAY-8 refund guard", () => {
    expect([...ACTIVE_ORDER_CHANGE_STATUSES].sort()).toEqual([...GUARD_STATUSES].sort())
  })

  it("warns with the message of rule 12, matching the wording of the PAY-8 toast", () => {
    expect(REFUND_BLOCKED_MESSAGE).toBe(
      "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first."
    )
    expect(ACTIVE_ORDER_CHANGE_REFUND_MESSAGE).toContain("active return, claim, exchange or edit. Confirm or cancel it first.")
  })

  // order_change ของ order preview = active change ที่ order module หาด้วย status pending/requested
  it("reads the active change of the order preview in a readable form", () => {
    expect(activeChangeType({ change_type: "return_request", status: "pending" })).toBe("return request")
    expect(activeChangeType({ change_type: "exchange", status: "requested" })).toBe("exchange")
    expect(activeChangeType({ change_type: null, status: "pending" })).toBe("order change")
  })

  it("is null when the order has no active change", () => {
    expect(activeChangeType(undefined)).toBeNull()
    expect(activeChangeType(null)).toBeNull()
    expect(activeChangeType({ change_type: "return", status: "confirmed" })).toBeNull()
    expect(activeChangeType({ change_type: "return", status: "canceled" })).toBeNull()
  })
})

// qa #471 D-2: dashboard 2.22.1 ทิ้ง `.before` แล้ววาง widget ต่อท้ายคอลัมน์หลัก → default layout ของหน้า order ให้ widget ขึ้นก่อน
describe("order details default layout", () => {
  it("targets the order details layout zone and the widget id declared in the widget config", () => {
    expect(ORDER_DETAILS_LAYOUT_ZONE).toBe("order.details")
    const source = fs.readFileSync(path.join(__dirname, "../../widgets/order-refund-blocked.tsx"), "utf8")
    // admin-vite-plugin อ่าน `id` เฉพาะ string literal ใน defineWidgetConfig
    expect(source).toMatch(/defineWidgetConfig\(\{[^}]*id: "order-refund-blocked"/)
    expect(REFUND_BLOCKED_WIDGET_LAYOUT_KEY).toBe("widget:order-refund-blocked")
  })

  it("puts the widget first when no layout exists", () => {
    expect(withRefundBlockedWidgetFirst(undefined)).toEqual({ "widget:order-refund-blocked": { order: -1 } })
  })

  it("keeps the other widgets of an existing default layout", () => {
    expect(withRefundBlockedWidgetFirst({ "core:summary": { order: 2 }, "widget:x": { hidden: true } })).toEqual({
      "core:summary": { order: 2 },
      "widget:x": { hidden: true },
      "widget:order-refund-blocked": { order: -1 },
    })
  })

  it("does not override a placement the admin already chose for the widget", () => {
    const widgets = { "widget:order-refund-blocked": { order: 5, section: "sidebar" } }
    expect(withRefundBlockedWidgetFirst(widgets)).toBeNull()
  })
})
