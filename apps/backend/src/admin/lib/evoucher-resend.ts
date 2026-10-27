import type { CodeStatus } from "./evoucher"

// EV-5b: resend ใช้ได้เมื่อ order มี code ที่ลูกค้าควรได้รับแล้ว (`delivered`) หรือส่งอีเมลล้ม (`allocated`, กฎข้อ 17)
export const canResendEvouchers = (codes: { status: CodeStatus }[]) =>
  codes.some((code) => code.status === "delivered" || code.status === "allocated")

const HINT = "Try again or check the server logs."

/** EV-13 (AC-32): ข้อความ toast ของ resend ที่ล้ม — ไม่แสดง id `noti_…` (id อยู่ใน log ของ server) */
export const resendErrorMessage = (err: Error) => {
  const raw = (err.message ?? "").trim()
  if (!raw) {
    return `Could not resend the e-voucher email. ${HINT}`
  }
  if (!/noti_[A-Za-z0-9]+/.test(raw)) {
    return raw
  }
  const message = raw
    .replace(/Failed to send notification with id \S+:\s*/g, "")
    .replace(/\s*noti_[A-Za-z0-9]+/g, "")
    .trim()
  return /log/i.test(message) ? message : `${message.replace(/[.\s]+$/, "")}. ${HINT}`
}
