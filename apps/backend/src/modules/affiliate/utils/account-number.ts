// AF-15 (spec 05 กฎ 39a, owner Q20): ตัด `-` และช่องว่างของเลขบัญชีแล้วต้องเป็นตัวเลข 10–12 หลัก
// ใช้ทั้ง validator ของ admin API และฟอร์มข้อมูลรับเงินใน admin (src/admin/lib/affiliate-account.ts) — ห้าม import อะไรเพิ่ม
export const normalizeAccountNumber = (value: string) => value.replace(/[-\s]/g, "")

export const isAccountNumber = (normalized: string) => /^\d{10,12}$/.test(normalized)
