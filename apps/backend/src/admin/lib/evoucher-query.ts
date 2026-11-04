import { CODE_STATUSES, type CodeStatus } from "./evoucher-status"

// ADM-4 (spec 08 กฎ 9): DataTable ของ dashboard เก็บหน้าปัจจุบัน/filter ใน URL (`<prefix>_offset`, `<prefix>_<filter id>`)
// หน้า/ตารางอ่านกลับด้วย useQueryParams (ได้ string ดิบ) แล้วแปลงเป็น query ของ admin API ที่นี่ (ไม่ import sdk เพื่อให้ unit test ได้)
type RawParams = { offset?: string; status?: string }

const toOffset = (raw?: string) => {
  const n = Number(raw)
  return raw && Number.isInteger(n) && n > 0 ? n : 0
}

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

export const poolsListQuery = (params: RawParams, pageSize: number) => ({
  limit: pageSize,
  offset: toOffset(params.offset),
})

export const codesListQuery = (params: RawParams, pageSize: number) => {
  const status = toStatus(params.status)
  return { ...poolsListQuery(params, pageSize), ...(status ? { status } : {}) }
}
