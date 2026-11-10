// AF-21 (spec 05 กฎ 45d): POST /affiliate/register ตอบ 400 `invalid_data` "Invalid request: This referral code is reserved"
// เมื่อ code เป็นคำสงวน — `FetchError` ของ js-sdk ไม่มี `code` จึงจับจากข้อความคงที่ (แบบ CORE-20d)
// ข้อความตรงกับ `RESERVED_CODE_MESSAGE` ของ backend (contract test)

export const AFFILIATE_RESERVED_CODE = "This referral code is reserved"

export const AFFILIATE_RESERVED_CODE_MESSAGE = "รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น"

/** ข้อความไทยของ error จาก POST /affiliate/register: คำสงวน → ข้อความเฉพาะ; อื่นๆ → `fallback` */
export const affiliateRegisterError = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback
  }
  const { status, message } = error as { status?: unknown; message?: unknown }
  return status === 400 &&
    typeof message === "string" &&
    message.toLowerCase().includes(AFFILIATE_RESERVED_CODE.toLowerCase())
    ? AFFILIATE_RESERVED_CODE_MESSAGE
    : fallback
}
