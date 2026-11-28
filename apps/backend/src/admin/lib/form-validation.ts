/**
 * ADM-3 (spec 08 กฎ 8): `optionalInt`/`optionalFloat` ของ dashboard ตั้งข้อความ error ด้วย `i18next.t(...)` ตอนโหลด module
 * ซึ่งยังไม่ init จึงได้ `undefined` และ zod แสดง "Invalid input" — ข้อความต่อช่องจึงใส่ผ่าน error map ตอน parse
 * (ใช้กับ issue ที่ไม่มีข้อความเท่านั้น; ข้อความที่ schema ระบุเองไม่ถูกแทน) ส่งเป็น schemaOptions ของ `zodResolver`
 * spec 10 กฎ 4d: ข้อความต่อช่องเป็น function (`{ starts_at: invalidDate }`) เรียกตอน parse ให้ได้ภาษาปัจจุบัน
 * — รับ string ได้ด้วย (ค่าที่ไม่ใช่ข้อความแปล); guard กฎ 14d จับ literal ข้อความในไฟล์ที่แปลแล้ว
 */
export const fieldErrorMap =
  (messages: Record<string, string | (() => string)>) =>
  (issue: { path?: PropertyKey[] }): string | undefined => {
    const message = messages[String(issue.path?.[0])]
    return typeof message === "function" ? message() : message
  }

/** ค่าว่างของช่องตัวเลขในฟอร์ม (input ส่ง `""`, ค่าที่ไม่ได้กรอกเป็น `undefined`) */
export const isBlank = (value: unknown): value is "" | undefined => value === "" || value === undefined

/**
 * ADM-12 (spec 08 กฎ 15): ค่าฟอร์มของ `<input type="number">` ที่ browser ถือว่าไม่ใช่ตัวเลข (`validity.badInput` เช่นพิมพ์ "e", "1e")
 * — browser ให้ value เป็น `""` จึงแยกจาก "ว่าง" ไม่ได้ เลยแทนด้วยสตริงที่ `castNumber` ได้ `NaN`
 * ให้ `optionalInt`/`optionalFloat` ของ dashboard (และ refine ต่อท้าย) ปฏิเสธด้วยข้อความเดิมของช่อง
 */
export const BAD_NUMBER_INPUT = "NaN"

export const numberInputValue = (el: { value: string; validity: { badInput: boolean } }): string =>
  el.validity.badInput ? BAD_NUMBER_INPUT : el.value
