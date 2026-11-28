// SFUI-11b (spec 09 กฎ 32b; ADR-032 D4): แปลผล validation native (required / type="email" / pattern) ของช่องเป็นข้อความไทย
// ไม่เพิ่ม/ลดกฎ — อ่านเฉพาะ ValidityState ที่ browser คำนวณ; `label` = ข้อความ label ของช่อง (ไม่มี *)

export type FieldValidity = Pick<ValidityState, "valid" | "valueMissing" | "typeMismatch" | "patternMismatch">

export type FieldErrorOptions = {
  label: string
  title?: string
  control?: "input" | "select"
}

export function fieldErrorMessage(
  validity: FieldValidity,
  { label, title, control = "input" }: FieldErrorOptions
): string | null {
  if (validity.valid) return null
  if (validity.valueMissing) return control === "select" ? `กรุณาเลือก${label}` : `กรุณากรอก${label}`
  if (validity.typeMismatch) return title || `กรุณากรอก${label}ให้ถูกต้อง`
  if (validity.patternMismatch) return title || `รูปแบบ${label}ไม่ถูกต้อง`
  return `${label}ไม่ถูกต้อง`
}
