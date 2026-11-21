// PAY-10 (spec 06 กฎข้อ 12): status ของ order change ที่ทำให้ middleware ของ PAY-8 ปฏิเสธ refund
// (ค่าเดียวกับ ACTIVE_ORDER_CHANGE_STATUSES ใน src/lib/active-order-change.ts — admin bundle ไม่ import โค้ดฝั่ง server; unit test ตรวจว่าตรงกัน)
export const ACTIVE_ORDER_CHANGE_STATUSES = ["pending", "requested"]

export const REFUND_BLOCKED_MESSAGE =
  "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first."

/**
 * ชนิดของ active change ของ order preview แบบอ่านง่าย (`return_request` → `return request`; ไม่มีชนิด → `order change`)
 * null = ไม่มี change ค้าง (order module มี active change ได้ครั้งละหนึ่งตัวต่อ order)
 */
export const activeChangeType = (change: { change_type?: string | null; status?: string | null } | null | undefined) =>
  change?.status && ACTIVE_ORDER_CHANGE_STATUSES.includes(change.status)
    ? change.change_type?.replace(/_/g, " ") || "order change"
    : null
