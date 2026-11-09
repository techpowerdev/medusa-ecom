import { z } from "zod"
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

const INVALID_DATE = "Invalid date"

// ADM-9 (spec 08 กฎ 8): รูปค่าของฟอร์ม — กฎตรวจอยู่ใน toPayoutBody แล้ว map error เข้า form.setError (แบบ toProgramBody)
export const payoutFormSchema = z.object({
  affiliate_id: z.string(),
  period_from: z.date().nullable(),
  period_to: z.date().nullable(),
})
export type PayoutForm = z.input<typeof payoutFormSchema>

export const PAYOUT_PARSE_OPTIONS = {
  error: fieldErrorMap({ period_from: INVALID_DATE, period_to: INVALID_DATE }),
}

type PayoutBody = { affiliate_id: string; period_from: Date; period_to: Date }

export const toPayoutBody = (
  form: PayoutForm,
): { body: PayoutBody } | { error: string; field: keyof PayoutForm } => {
  const { affiliate_id, period_from, period_to } = form
  if (!affiliate_id) {
    return { error: "Select an affiliate", field: "affiliate_id" }
  }
  if (!period_from) {
    return { error: "From is required", field: "period_from" }
  }
  if (!period_to) {
    return { error: "To is required", field: "period_to" }
  }
  if (period_to.getTime() <= period_from.getTime()) {
    return { error: "To must be after From", field: "period_to" }
  }
  return { body: { affiliate_id, period_from, period_to } }
}

// validator ของ mark-paid เป็น `min(1).optional()` — ว่าง/ช่องว่างล้วนต้องไม่ส่ง key (ส่ง "" ได้ 400)
export const markPaidBody = (reference: string): { reference?: string } => {
  const trimmed = reference.trim()
  return trimmed ? { reference: trimmed } : {}
}

export type AffiliateOption = Pick<Affiliate, "id" | "name" | "email" | "status">

// ADM-9 (spec 08 กฎ 11): route ไม่มี `q` และ limit สูงสุด 200 — ดึงครบทุกหน้าแล้วให้ Combobox ค้นหาฝั่ง client ไม่ตัดรายการเงียบ
export const fetchAllAffiliates = async <T>(
  fetchPage: (offset: number, limit: number) => Promise<{ affiliates: T[]; count: number }>,
): Promise<T[]> => {
  const all: T[] = []
  for (;;) {
    const { affiliates, count } = await fetchPage(all.length, 200)
    all.push(...affiliates)
    if (!affiliates.length || all.length >= count) {
      return all
    }
  }
}

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
