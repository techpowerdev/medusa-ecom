// error code ของ payment (spec 06) — ตัวที่เป็น 409 อยู่ใน BUSINESS_CONFLICT_CODES (src/api/error-handler.ts)
// PAY-6 (กฎข้อ 7A): session Stripe เดิมชำระแล้วหรือกำลังชำระ → guard ตอบ 409 แทนการลบ session
export const PAYMENT_ALREADY_COMPLETED = "PAYMENT_ALREADY_COMPLETED"
// PAY-9 (กฎข้อ 11, ADR-025): collection ของ cart ถูกคืนเงินครบแล้ว → ถอด link แล้ว storefront สร้าง collection ใหม่ 1 ครั้ง
export const PAYMENT_COLLECTION_RESET = "PAYMENT_COLLECTION_RESET"
