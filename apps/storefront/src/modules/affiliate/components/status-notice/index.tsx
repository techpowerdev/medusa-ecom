import type { PortalAffiliate } from "@lib/data/affiliate-portal"

const MESSAGES: Record<PortalAffiliate["status"], string> = {
  pending: "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลอนุมัติ หน้านี้จะใช้งานได้เมื่อได้รับอนุมัติแล้ว ระหว่างนี้ดูโปรไฟล์ของคุณได้",
  suspended: "บัญชีของคุณถูกระงับชั่วคราว จึงดูหน้านี้ไม่ได้ ยังดูรายได้ การจ่ายเงิน และโปรไฟล์ได้ตามปกติ",
  active: "คุณยังไม่มีสิทธิ์ดูหน้านี้",
}

/** AF-8b (กฎ 33, Q6): route ที่ API ตอบ 403 ตามสถานะ → ข้อความไทยตามสถานะ ไม่ใช่หน้า error */
export default function StatusNotice({ status }: { status: PortalAffiliate["status"] }) {
  return (
    <p className="rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4" data-testid="affiliate-status-notice">
      {MESSAGES[status]}
    </p>
  )
}
