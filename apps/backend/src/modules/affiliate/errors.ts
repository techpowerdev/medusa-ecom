// error code ของ affiliate — ตัวที่เป็น 409 อยู่ใน BUSINESS_CONFLICT_CODES (src/api/error-handler.ts)
// AF-15 (spec 05 กฎ 39b): expected_status ไม่ตรงสถานะปัจจุบัน (กดจากหน้าเก่า)
export const AFFILIATE_STATUS_CHANGED = "AFFILIATE_STATUS_CHANGED"

// 400 INVALID_DATA (spec 05 กฎ 45): code คำสงวนตอน POST /affiliate/register — ไม่ใช่ 409 จึงไม่อยู่ใน BUSINESS_CONFLICT_CODES
// CORE-84 (spec 01 กฎข้อ 140, ADR-028): storefront ตัดสินจาก code นี้แทนข้อความ
export const AFFILIATE_CODE_RESERVED = "AFFILIATE_CODE_RESERVED"
