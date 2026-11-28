import { Alert, AlertDescription } from "@/components/ui/alert"
import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

// SFUI-12b (spec 09 กฎ 32d): `id` ไม่บังคับ — ให้ช่องที่เกี่ยวข้องอ้างด้วย aria-describedby (promotion-error)
// SFUI-21d (กฎ 74 (a), ADR-034 D4): error ระดับฟอร์ม/การกระทำ/ขั้น = Alert destructive ของ shadcn ตามตัวอย่าง docs (icon + AlertDescription,
// ไม่มี AlertTitle) — testid/id อยู่บน root (role="alert"); `error` รับข้อความหรือ node (ลิงก์/ปุ่มในข้อความ เช่น register-email-exists, return-contact-store)
// error ในแถว/เซลล์ใช้ FieldError ตรง (กฎ 74 (b)) ไม่ผ่าน component นี้
const ErrorMessage = ({ error, id, "data-testid": dataTestid }: { error?: ReactNode; id?: string; "data-testid"?: string }) => {
  if (!error) {
    return null
  }

  return (
    <Alert variant="destructive" id={id} data-testid={dataTestid}>
      <CircleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

export default ErrorMessage
