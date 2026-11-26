import { t } from "../i18n/t"
import type { CodeStatus } from "./evoucher"

// EV-5b: resend ใช้ได้เมื่อ order มี code ที่ลูกค้าควรได้รับแล้ว (`delivered`) หรือส่งอีเมลล้ม (`allocated`, กฎข้อ 17)
export const canResendEvouchers = (codes: { status: CodeStatus }[]) =>
  codes.some((code) => code.status === "delivered" || code.status === "allocated")

// spec 10 กฎ 4d (AI18N-3): function เรียกตอนรัน (ภาษาปัจจุบัน)
export const hint = () => t("ecom-evoucher", "resend.hint")

// ADM-2a (nit EV-13 #167): reason ที่ลงท้ายด้วยจุดในวงเล็บของ backend ("(smtp down.). Try…") ไม่ให้จุดซ้อน
// EV-26 (กฎข้อ 42c): allocate ใช้ตัวจัดข้อความเดียวกัน
export const tidyStops = (message: string) => message.replace(/\.+\)/g, ")").replace(/\.{2,}/g, ".")

/** EV-13 (AC-32): ข้อความ toast ของ resend ที่ล้ม — ไม่แสดง id `noti_…` (id อยู่ใน log ของ server) */
export const resendErrorMessage = (err: Error) => {
  const raw = (err.message ?? "").trim()
  if (!raw) {
    return t("ecom-evoucher", "resend.error", { hint: hint() })
  }
  if (!/noti_[A-Za-z0-9]+/.test(raw)) {
    return tidyStops(raw)
  }
  const message = raw
    .replace(/Failed to send notification with id \S+:\s*/g, "")
    .replace(/\s*noti_[A-Za-z0-9]+/g, "")
    .trim()
  return tidyStops(/log/i.test(message) ? message : `${message.replace(/[.\s]+$/, "")}. ${hint()}`)
}
