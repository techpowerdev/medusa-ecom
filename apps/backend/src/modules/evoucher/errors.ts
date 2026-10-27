// error code ของ evoucher ที่ถึง client เป็น 409 ผ่าน errorHandler กลาง (spec 02 กฎข้อ 10, spec 03 กฎข้อ 13)
export const EVOUCHER_CODE_NOT_AVAILABLE = "EVOUCHER_CODE_NOT_AVAILABLE"
// กฎข้อ 12: stock ที่เหลือถูก order จองหมดแล้ว — void จะทำให้ order นั้น backordered
export const EVOUCHER_CODE_RESERVED = "EVOUCHER_CODE_RESERVED"
// EV-5b: resend ของ order เดียวกันกำลังทำงานอยู่ (lock ต่อ order) — กันส่งอีเมลซ้ำจากการยิงพร้อมกัน
export const EVOUCHER_RESEND_IN_PROGRESS = "EVOUCHER_RESEND_IN_PROGRESS"
