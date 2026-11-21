// CORE-80 (spec 01 กฎข้อ 138): อีเมลเก็บ/เทียบเป็นตัวเล็กที่เดียว — emailpass ใช้ `email` เป็น `entity_id` ตรงๆ (case-sensitive)
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()
