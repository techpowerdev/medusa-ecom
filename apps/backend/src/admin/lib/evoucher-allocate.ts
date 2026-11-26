import { t } from "../i18n/t"
import { hint, tidyStops } from "./evoucher-resend"

// รูปร่าง response ของ POST /admin/evoucher/orders/:id/allocate (EV-23, spec 02 กฎข้อ 39) — admin bundle ไม่ import โค้ดฝั่ง server
export type AllocateResult = {
  allocated_line_item_ids: string[]
  backordered_line_item_ids: string[]
  stuck_line_item_ids: string[]
}

// spec 10 กฎ 4d (AI18N-3): ข้อความเป็น function เรียกตอนรัน (ภาษาปัจจุบัน)
const backorderedMessage = () => t("ecom-evoucher", "allocate.backordered")
// review #472: code allocated แต่ส่งอีเมลไม่สำเร็จ (กฎข้อ 17) — ลูกค้ายังไม่ได้รับ จึงห้ามแจ้ง "Codes allocated"
const stuckMessage = () => t("ecom-evoucher", "allocate.stuck")

/**
 * EV-24 (กฎข้อ 40): toast หลังกด Retry allocation — `warning` เมื่อมี line ที่ต้อง resend (เกินกฎข้อ 40 ตาม review #472)
 * EV-26 (กฎข้อ 42a): ยัง backordered = ยังไม่ได้ส่ง code จึงเป็น `warning` ด้วย — `success` เฉพาะ allocate ครบ
 */
export const allocateResultToast = (result: AllocateResult): { variant: "success" | "warning"; message: string } => {
  const backordered = result.backordered_line_item_ids.length > 0
  if (result.stuck_line_item_ids.length > 0) {
    return { variant: "warning", message: backordered ? `${backorderedMessage()}. ${stuckMessage()}` : stuckMessage() }
  }
  return backordered
    ? { variant: "warning", message: backorderedMessage() }
    : { variant: "success", message: t("ecom-evoucher", "allocate.success") }
}

/** 4xx/5xx → ข้อความจาก API (เช่น order canceled / payment ยังไม่ captured) จัดจุดแบบเดียวกับ resend (EV-26 กฎข้อ 42c) */
export const allocateErrorMessage = (err: Error) =>
  tidyStops((err.message ?? "").trim() || t("ecom-evoucher", "allocate.error", { hint: hint() }))
