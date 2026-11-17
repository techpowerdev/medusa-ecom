// GB-17 (spec 04 กฎข้อ 40): ค่าสูงสุดของ column `integer` (int4) ของ Postgres — validator ของ admin route ใช้ `.max(INT4_MAX)`
// เพื่อให้ค่าที่เกินได้ 400 invalid_data แทน 500 `integer out of range` (`.int()` ของ zod ยอมถึง MAX_SAFE_INTEGER)
export const INT4_MAX = 2147483647
