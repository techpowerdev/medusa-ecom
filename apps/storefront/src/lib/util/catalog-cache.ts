// FS-17 (spec 03 กฎข้อ 22, ADR-017 ทางเลือก A): อายุ Data Cache ของ fetch ข้อมูลแคตตาล็อก (วินาที)
// ตอน render หน้า static/ISR ไม่มี cookie `_medusa_cache_id` จึงไม่มี tag — ถ้าไม่ตั้ง revalidate Next จะ cache ผล fetch ไม่มีกำหนด
export const CATALOG_REVALIDATE_SECONDS = 60
// FS-18 (กฎข้อ 23a): ใช้กับทุก fetch `force-cache` ใน lib/data ที่ admin เปลี่ยนข้อมูลได้ (category, region, collection, locale,
// payment provider, variant) — ยกเว้นข้อมูลต่อ cart/ลูกค้าที่ revalidate ตาม tag หลัง mutation (รายการใน catalog-revalidate.test.ts)
