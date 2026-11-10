import { CODE_STATUSES, type CodeStatus } from "./evoucher-status"

// ADM-4 (spec 08 กฎ 9): DataTable ของ dashboard เก็บหน้าปัจจุบัน/filter ใน URL (`<prefix>_offset`, `<prefix>_<filter id>`)
// หน้า/ตารางอ่านกลับด้วย useQueryParams (ได้ string ดิบ) แล้วแปลงเป็น query ของ admin API ที่นี่ (ไม่ import sdk เพื่อให้ unit test ได้)
// offset ผ่าน usePageOffset (ADM-10, กฎ 13) แล้ว — ที่นี่รับเป็นตัวเลข

const isCodeStatus = (value: unknown): value is CodeStatus =>
  typeof value === "string" && (CODE_STATUSES as readonly string[]).includes(value)

// ค่า filter แบบ radio ถูกเขียนเป็น JSON.stringify(value); อ่านแบบเดียวกับ parseFilterValue ของ dashboard (JSON ไม่ได้ → ใช้ string ดิบ)
const toStatus = (raw?: string): CodeStatus | undefined => {
  if (!raw) {
    return undefined
  }
  let value: unknown = raw
  try {
    value = JSON.parse(raw)
  } catch {
    // ค่าดิบ
  }
  return isCodeStatus(value) ? value : undefined
}

export const codesListQuery = (rawStatus: string | undefined, offset: number, pageSize: number) => {
  const status = toStatus(rawStatus)
  return { limit: pageSize, offset, ...(status ? { status } : {}) }
}
