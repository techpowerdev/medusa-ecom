// PAY-10 (spec 06 กฎข้อ 12): status ของ order change ที่ทำให้ middleware ของ PAY-8 ปฏิเสธ refund
// (ค่าเดียวกับ ACTIVE_ORDER_CHANGE_STATUSES ใน src/lib/active-order-change.ts — admin bundle ไม่ import โค้ดฝั่ง server; unit test ตรวจว่าตรงกัน)
export const ACTIVE_ORDER_CHANGE_STATUSES = ["pending", "requested"]

export const REFUND_BLOCKED_MESSAGE =
  "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first."

/** ชนิดของ change ที่ค้าง (ไม่ซ้ำ, อ่านง่าย) เช่น `update_order` → `update order`; ไม่มีชนิด → `order change` */
export const pendingChangeTypes = (changes: { change_type?: string | null }[] | undefined) => [
  ...new Set((changes ?? []).map((c) => c.change_type?.replace(/_/g, " ") || "order change")),
]
