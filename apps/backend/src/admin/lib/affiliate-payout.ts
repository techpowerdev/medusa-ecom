import type { Affiliate, Payout } from "./affiliate"

// AF-6 (AC-26): payout `paid` ยกเลิกไม่ได้ (backend ตอบ 400) จึงไม่แสดงปุ่ม
export const canCancelPayout = (payout: Pick<Payout, "status">) => payout.status === "draft"

// AF-12c (spec 05 กฎ 37c): mark paid ได้เฉพาะ `draft`; แถว `paid` ไม่มีทั้งปุ่ม mark paid และ cancel
export const canMarkPaid = (payout: Pick<Payout, "status">) => payout.status === "draft"

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000

const ymd = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)

/** ค่าเริ่มต้นของฟอร์ม = เดือนก่อนหน้าตามเวลาไทย `[วันที่ 1, วันที่ 1 ของเดือนนี้)` เป็นวันที่ (YYYY-MM-DD, ICT) */
export const defaultPayoutPeriod = (now: Date) => {
  const ict = new Date(now.getTime() + ICT_OFFSET_MS)
  const year = ict.getUTCFullYear()
  const month = ict.getUTCMonth()
  return { period_from: ymd(year, month - 1), period_to: ymd(year, month) }
}

export type PayoutForm = { affiliate_id: string; period_from: string; period_to: string }
type PayoutBody = PayoutForm

// วันที่จาก <input type="date"> = 00:00 เวลาไทยของวันนั้น ส่งเป็น ISO
const ictDateToIso = (value: string) => {
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const toPayoutBody = (
  form: PayoutForm,
): { body: PayoutBody } | { error: string; field: keyof PayoutForm } => {
  if (!form.affiliate_id) {
    return { error: "Select an affiliate", field: "affiliate_id" }
  }
  const period_from = form.period_from ? ictDateToIso(form.period_from) : null
  if (!period_from) {
    return { error: "From is required", field: "period_from" }
  }
  const period_to = form.period_to ? ictDateToIso(form.period_to) : null
  if (!period_to) {
    return { error: "To is required", field: "period_to" }
  }
  if (period_to <= period_from) {
    return { error: "To must be after From", field: "period_to" }
  }
  return { body: { affiliate_id: form.affiliate_id, period_from, period_to } }
}

// validator ของ mark-paid เป็น `min(1).optional()` — ว่าง/ช่องว่างล้วนต้องไม่ส่ง key (ส่ง "" ได้ 400)
export const markPaidBody = (reference: string): { reference?: string } => {
  const trimmed = reference.trim()
  return trimmed ? { reference: trimmed } : {}
}

export type AffiliateOption = Pick<Affiliate, "id" | "name" | "email" | "status">

// filter status ของ GET /admin/affiliate/affiliates รับค่าเดียว → ยิง active และ suspended แยกแล้วรวมผล (ไม่ซ้ำ id)
export const mergeAffiliateOptions = (...lists: AffiliateOption[][]) => {
  const byId = new Map<string, AffiliateOption>()
  for (const affiliate of lists.flat()) {
    if (!byId.has(affiliate.id)) {
      byId.set(affiliate.id, affiliate)
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
