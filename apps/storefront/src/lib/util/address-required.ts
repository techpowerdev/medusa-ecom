// CORE-52/CORE-58/CORE-63 (spec 01 กฎข้อ 110b, 116a, 121b): ช่องบังคับของที่อยู่ชุดเดียวกันทั้ง checkout และหน้าบัญชี
// อยู่ที่นี่เพราะ `lib/data/{cart,customer}.ts` เป็น "use server" (export ได้เฉพาะ async function)
// SFUI-18c (spec 09 กฎ 55; Q-R49-4 owner): ตำบล/แขวง (address_2) บังคับกรอก
export const REQUIRED_ADDRESS_FIELDS = ["first_name", "last_name", "address_1", "address_2", "postal_code", "city"] as const
export const MISSING_ADDRESS_MESSAGE =
  "กรุณากรอกชื่อ นามสกุล ที่อยู่ ตำบล/แขวง เขต/อำเภอ และรหัสไปรษณีย์ให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)"

/** ช่องบังคับใดว่าง — ผู้เรียกตัด white space/zero-width ด้วย `trimInvisible` ก่อน */
export const missingRequiredAddress = (
  address: Partial<Record<(typeof REQUIRED_ADDRESS_FIELDS)[number], string | null>>
) => REQUIRED_ADDRESS_FIELDS.some((field) => !address[field])
