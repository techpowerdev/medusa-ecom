// error code ของ group buy (spec 04 กฎข้อ 11) — ตัวที่เป็น 409 อยู่ใน BUSINESS_CONFLICT_CODES (src/api/error-handler.ts)
export const GB_ALREADY_IN_OTHER_GROUP = "GB_ALREADY_IN_OTHER_GROUP"
export const GB_GROUP_FULL = "GB_GROUP_FULL"
export const GB_MAX_TOTAL_ORDERS_REACHED = "GB_MAX_TOTAL_ORDERS_REACHED"
export const GB_UNITS_LIMIT_EXCEEDED = "GB_UNITS_LIMIT_EXCEEDED"
export const GB_ITEMS_NOT_ELIGIBLE = "GB_ITEMS_NOT_ELIGIBLE"
// owner 2026-10-26: cart หนึ่งใบ join ได้ครั้งเดียว และ cart ที่มี GB-* complete ไม่ได้ (ส่วนลดกลุ่มใช้ผ่าน draft order เท่านั้น)
export const GB_CART_ALREADY_JOINED = "GB_CART_ALREADY_JOINED"
// 400 NOT_ALLOWED (กฎข้อ 14a, AC-26) — ไม่อยู่ใน BUSINESS_CONFLICT_CODES
export const GB_CART_NOT_COMPLETABLE = "GB_CART_NOT_COMPLETABLE"
// 400 NOT_ALLOWED (กฎข้อ 5, AC-23) — ไม่ใช่ 409 จึงห้ามอยู่ใน BUSINESS_CONFLICT_CODES
export const GB_DISCOUNT_NOT_APPLIED = "GB_DISCOUNT_NOT_APPLIED"

export const GB_CONFLICT_CODES = [
  GB_ALREADY_IN_OTHER_GROUP,
  GB_GROUP_FULL,
  GB_MAX_TOTAL_ORDERS_REACHED,
  GB_UNITS_LIMIT_EXCEEDED,
  GB_ITEMS_NOT_ELIGIBLE,
  GB_CART_ALREADY_JOINED,
] as const
