import { t } from "../i18n/t"

// PAY-10 (spec 06 กฎข้อ 12): status ของ order change ที่ทำให้ middleware ของ PAY-8 ปฏิเสธ refund
// (ค่าเดียวกับ ACTIVE_ORDER_CHANGE_STATUSES ใน src/lib/active-order-change.ts — admin bundle ไม่ import โค้ดฝั่ง server; unit test ตรวจว่าตรงกัน)
// spec 10 กฎ 7: ทุกค่ามี key `orderChangeStatus.<status>` ใน ecom-evoucher
export const ACTIVE_ORDER_CHANGE_STATUSES = ["pending", "requested"]

/** spec 10 กฎ 4d, 8 (AI18N-3): ข้อความเตือนของ admin แปลตอนเรียก — ค่า `en` เท่าถ้อยคำของ toast PAY-8 (unit ตรวจ) */
export const refundBlockedMessage = () => t("ecom-evoucher", "refundBlocked.message")

/**
 * ชนิดของ active change ของ order preview ที่แปลแล้ว (`return_request` → `return request` ใน en; ไม่มีชนิด → `order change`)
 * ชนิดที่ไม่มี key แสดงค่าดิบแบบอ่านง่าย (spec 10 กฎ 7) — null = ไม่มี change ค้าง (order module มี active change ได้ครั้งละหนึ่งตัวต่อ order)
 */
export const activeChangeType = (change: { change_type?: string | null; status?: string | null } | null | undefined) => {
  if (!change?.status || !ACTIVE_ORDER_CHANGE_STATUSES.includes(change.status)) {
    return null
  }
  const type = change.change_type
  return type
    ? t("ecom-evoucher", `refundBlocked.changeType.${type}`, { defaultValue: type.replace(/_/g, " ") })
    : t("ecom-evoucher", "refundBlocked.orderChange")
}
