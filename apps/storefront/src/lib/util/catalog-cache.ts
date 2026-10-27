// FS-17 (spec 03 กฎข้อ 22, ADR-017 ทางเลือก A): อายุ Data Cache ของ fetch ข้อมูลแคตตาล็อก (วินาที)
// ตอน render หน้า static/ISR ไม่มี cookie `_medusa_cache_id` จึงไม่มี tag — ถ้าไม่ตั้ง revalidate Next จะ cache ผล fetch ไม่มีกำหนด
export const CATALOG_REVALIDATE_SECONDS = 60
