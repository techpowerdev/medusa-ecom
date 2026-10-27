import type { CodeStatus } from "./evoucher"

// EV-5b: resend ใช้ได้เมื่อ order มี code ที่ลูกค้าควรได้รับแล้ว (`delivered`) หรือส่งอีเมลล้ม (`allocated`, กฎข้อ 17)
export const canResendEvouchers = (codes: { status: CodeStatus }[]) =>
  codes.some((code) => code.status === "delivered" || code.status === "allocated")
