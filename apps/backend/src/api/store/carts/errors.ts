// CORE-76 (spec 01 กฎข้อ 134 a2 — session หลักตัดสิน 2026-11-21 ตามรายงาน builder CORE-76): `POST /store/carts/:id/complete`
// ของ Medusa 2.22.1 throw CONFLICT ไม่มี code ข้อความนี้เมื่อ workflow ของ cart เดียวกันยังรันอยู่ (เช่น webhook กำลัง complete)
// แต่ errorHandler ของ Medusa เขียนทับข้อความ 409 เป็นข้อความกลาง → businessErrorHandler ตอบ 409 พร้อม code นี้แทน
// contract test (`__tests__/error-handler.unit.spec.ts`) เทียบข้อความกับ source ของ @medusajs/medusa ที่ติดตั้ง (spec 07 ข้อ 17)
export const CART_COMPLETION_IN_PROGRESS = "CART_COMPLETION_IN_PROGRESS"
export const CART_COMPLETION_IN_PROGRESS_MESSAGE = "Cart is already being completed by another request"
