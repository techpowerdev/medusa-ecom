// AF-21 (spec 05 กฎ 45d): POST /affiliate/register ตอบ 400 `invalid_data` code `AFFILIATE_CODE_RESERVED` เมื่อ code เป็นคำสงวน
// CORE-84 (spec 01 กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ `MedusaApiError` (`medusaFetch`) — ไม่เทียบข้อความของ backend
// code ตรงกับ `AFFILIATE_CODE_RESERVED` ของ backend (contract test)

export const AFFILIATE_RESERVED_CODE = "AFFILIATE_CODE_RESERVED"

export const AFFILIATE_RESERVED_CODE_MESSAGE = "รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น"

/** ข้อความไทยของ error จาก POST /affiliate/register: คำสงวน → ข้อความเฉพาะ; อื่นๆ → `fallback` */
export const affiliateRegisterError = (error: unknown, fallback: string): string => {
  const { status, code } = (typeof error === "object" && error !== null ? error : {}) as { status?: unknown; code?: unknown }
  return status === 400 && code === AFFILIATE_RESERVED_CODE ? AFFILIATE_RESERVED_CODE_MESSAGE : fallback
}
