// CORE-52/CORE-58/CORE-63 (spec 01 กฎข้อ 110b, 116a, 121b): ช่องบังคับของที่อยู่ชุดเดียวกันทั้ง checkout และหน้าบัญชี
// อยู่ที่นี่เพราะ `lib/data/{cart,customer}.ts` เป็น "use server" (export ได้เฉพาะ async function)
// SFUI-18c (spec 09 กฎ 55; Q-R49-4 owner): ตำบล/แขวง (address_2) บังคับกรอก
// SFUI-20a (spec 09 กฎ 69; owner 2026-11-28): จังหวัด (province) บังคับกรอก — ลำดับตามฟอร์มที่อยู่ไทย
export const REQUIRED_ADDRESS_FIELDS = ["first_name", "last_name", "address_1", "address_2", "city", "province", "postal_code"] as const
export const MISSING_ADDRESS_MESSAGE =
  "กรุณากรอกชื่อ นามสกุล ที่อยู่ ตำบล/แขวง เขต/อำเภอ จังหวัด และรหัสไปรษณีย์ให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)"

/** SFUI-20a/20b (spec 09 กฎ 70 — ADR-034 D5): ร้านเปิดขายเฉพาะประเทศไทย — ค่าประเทศของที่อยู่ทุกฟอร์ม (ที่เดียว) */
export const ADDRESS_COUNTRY_CODE = "th"

/** ช่องบังคับใดว่าง — ผู้เรียกตัด white space/zero-width ด้วย `trimInvisible` ก่อน */
export const missingRequiredAddress = (
  address: Partial<Record<(typeof REQUIRED_ADDRESS_FIELDS)[number], string | null>>
) => REQUIRED_ADDRESS_FIELDS.some((field) => !address[field])
