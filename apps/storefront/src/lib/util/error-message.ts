// spec 01 กฎข้อ 45: ข้อความ error ที่ผู้ใช้เห็นใช้ `error.message` — `String(error)` จะได้คำนำหน้า "Error: "
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const SIGN_IN_AGAIN_MESSAGE = "กรุณาเข้าสู่ระบบอีกครั้ง"
export const GENERIC_ERROR_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
// CORE-4h (spec 01 กฎข้อ 69a): ใช้ทั้ง action login และ component login (ตัดสินจาก `reason` ไม่ใช่ข้อความ)
export const INVALID_CREDENTIALS_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"

// qa CORE-4c2 D-1/D-3: error ดิบของ Medusa เป็นภาษาอังกฤษ ("Unauthorized", "Variants … do not exist")
// แปลงเป็นข้อความไทย: 401/403 (`FetchError.status` ของ js-sdk) → ให้เข้าสู่ระบบใหม่, อื่นๆ → `fallback`
export const friendlyErrorMessage = (
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE
) => {
  const status = (error as { status?: unknown } | null)?.status
  return status === 401 || status === 403 ? SIGN_IN_AGAIN_MESSAGE : fallback
}
