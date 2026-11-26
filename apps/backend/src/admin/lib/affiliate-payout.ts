import { z } from "zod"
import { t } from "../i18n/t"
import type { Affiliate, Payout } from "./affiliate"
import { fieldErrorMap } from "./form-validation"

// AF-6 (AC-26): payout `paid` ยกเลิกไม่ได้ (backend ตอบ 400) จึงไม่แสดงปุ่ม
export const canCancelPayout = (payout: Pick<Payout, "status">) => payout.status === "draft"

// AF-12c (spec 05 กฎ 37c): mark paid ได้เฉพาะ `draft`; แถว `paid` ไม่มีทั้งปุ่ม mark paid และ cancel
export const canMarkPaid = (payout: Pick<Payout, "status">) => payout.status === "draft"

/** ADM-9 (spec 08 กฎ 5): ค่าเริ่มต้นของฟอร์ม = เดือนก่อนหน้าตามเวลาเครื่องของแอดมิน `[วันที่ 1 00:00, วันที่ 1 ของเดือนนี้ 00:00)` */
export const defaultPayoutPeriod = (now: Date) => ({
  period_from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
  period_to: new Date(now.getFullYear(), now.getMonth(), 1),
})

// spec 10 กฎ 4d (AI18N-4): ข้อความเป็น function — แปลตอน parse ตามภาษาปัจจุบัน
const invalidDate = () => t("ecom-affiliate", "payoutForm.errors.invalidDate")

// ADM-9 (spec 08 กฎ 8): รูปค่าของฟอร์ม — กฎตรวจอยู่ใน toPayoutBody แล้ว map error เข้า form.setError (แบบ toProgramBody)
export const payoutFormSchema = z.object({
  affiliate_id: z.string(),
  period_from: z.date().nullable(),
  period_to: z.date().nullable(),
})
export type PayoutForm = z.input<typeof payoutFormSchema>

export const PAYOUT_PARSE_OPTIONS = {
  error: fieldErrorMap({ period_from: invalidDate, period_to: invalidDate }),
}

type PayoutBody = { affiliate_id: string; period_from: Date; period_to: Date }

export const toPayoutBody = (
  form: PayoutForm,
): { body: PayoutBody } | { error: string; field: keyof PayoutForm } => {
  const { affiliate_id, period_from, period_to } = form
  if (!affiliate_id) {
    return { error: t("ecom-affiliate", "payoutForm.errors.affiliate"), field: "affiliate_id" }
  }
  if (!period_from) {
    return { error: t("ecom-affiliate", "payoutForm.errors.fromRequired"), field: "period_from" }
  }
  if (!period_to) {
    return { error: t("ecom-affiliate", "payoutForm.errors.toRequired"), field: "period_to" }
  }
  if (period_to.getTime() <= period_from.getTime()) {
    return { error: t("ecom-affiliate", "payoutForm.errors.toAfterFrom"), field: "period_to" }
  }
  return { body: { affiliate_id, period_from, period_to } }
}

// validator ของ mark-paid เป็น `min(1).optional()` — ว่าง/ช่องว่างล้วนต้องไม่ส่ง key (ส่ง "" ได้ 400)
export const markPaidBody = (reference: string): { reference?: string } => {
  const trimmed = reference.trim()
  return trimmed ? { reference: trimmed } : {}
}

// ADM-24 (spec 08 กฎ 28b): params ของ useComboboxData (q/id/limit/offset) + active และ suspended ใน request เดียว
// เรียงชื่อฝั่ง server (order=name, tiebreak ด้วย id) → รายการเรียงชื่อข้ามหน้า ไม่เรียงซ้ำฝั่ง client; pending ไม่อยู่ในตัวเลือก
export type AffiliateOptionParams = { q?: string; id?: string; limit?: number; offset?: number }

export const affiliateOptionsQuery = (params: AffiliateOptionParams) => ({
  ...params,
  status: ["active", "suspended"] as Affiliate["status"][],
  order: "name",
  fields: "id,name,email,status",
})
