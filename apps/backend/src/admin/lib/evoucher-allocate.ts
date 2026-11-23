// รูปร่าง response ของ POST /admin/evoucher/orders/:id/allocate (EV-23, spec 02 กฎข้อ 39) — admin bundle ไม่ import โค้ดฝั่ง server
export type AllocateResult = {
  allocated_line_item_ids: string[]
  backordered_line_item_ids: string[]
  stuck_line_item_ids: string[]
}

const BACKORDERED = "Still backordered — import more codes first"
// review #472: code allocated แต่ส่งอีเมลไม่สำเร็จ (กฎข้อ 17) — ลูกค้ายังไม่ได้รับ จึงห้ามแจ้ง "Codes allocated"
const STUCK = "Some codes were allocated but not emailed — use Resend email"

/** EV-24 (กฎข้อ 40): toast หลังกด Retry allocation — `warning` เมื่อมี line ที่ต้อง resend (เกินกฎข้อ 40 ตาม review #472) */
export const allocateResultToast = (result: AllocateResult): { variant: "success" | "warning"; message: string } => {
  const backordered = result.backordered_line_item_ids.length > 0
  if (result.stuck_line_item_ids.length > 0) {
    return { variant: "warning", message: backordered ? `${BACKORDERED}. ${STUCK}` : STUCK }
  }
  return { variant: "success", message: backordered ? BACKORDERED : "Codes allocated" }
}

/** 4xx/5xx → ข้อความจาก API (เช่น order canceled / payment ยังไม่ captured) */
export const allocateErrorMessage = (err: Error) =>
  (err.message ?? "").trim() || "Could not allocate e-voucher codes. Try again or check the server logs."
