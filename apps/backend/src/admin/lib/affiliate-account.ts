import type { Affiliate } from "./affiliate"

// AF-12b (spec 05 กฎ 37b): ปุ่มเดียวต่อแถวตามสถานะ affiliate — suspend ต้องยืนยันด้วย usePrompt
export type AffiliateAction = {
  testId: "affiliate-approve" | "affiliate-suspend" | "affiliate-reactivate"
  label: string
  status: Affiliate["status"]
  confirm: boolean
}

const ACTIONS: Record<Affiliate["status"], AffiliateAction> = {
  pending: { testId: "affiliate-approve", label: "Approve", status: "active", confirm: false },
  active: { testId: "affiliate-suspend", label: "Suspend", status: "suspended", confirm: true },
  suspended: { testId: "affiliate-reactivate", label: "Reactivate", status: "active", confirm: false },
}

export const affiliateAction = (status: Affiliate["status"]) => ACTIONS[status]

// owner Q18: ข้อมูลรับเงินมี 3 ช่องนี้เท่านั้นใน v1 (โอนธนาคาร ADR-005)
export const PAYOUT_INFO_FIELDS = ["bank_name", "account_name", "account_number"] as const
export type PayoutInfo = Record<(typeof PAYOUT_INFO_FIELDS)[number], string>

/** ค่าเริ่มต้นของฟอร์มจาก payout_info ที่เก็บไว้ (key อื่น/ค่าที่ไม่ใช่ string ถูกละ) */
export const payoutInfoForm = (stored: Record<string, unknown> | null | undefined): PayoutInfo => {
  const value = (key: string) => (typeof stored?.[key] === "string" ? (stored[key] as string) : "")
  return {
    bank_name: value("bank_name"),
    account_name: value("account_name"),
    account_number: value("account_number"),
  }
}

/** validator ฝั่ง admin: trim ทุกช่อง และทั้ง 3 ช่องต้องไม่ว่าง — ส่งเฉพาะ 3 key นี้ */
export const parsePayoutInfo = (
  form: PayoutInfo,
): { ok: true; value: PayoutInfo } | { ok: false; errors: Partial<PayoutInfo> } => {
  const value = payoutInfoForm(form)
  const errors: Partial<PayoutInfo> = {}
  for (const key of PAYOUT_INFO_FIELDS) {
    value[key] = value[key].trim()
    if (!value[key]) {
      errors[key] = "Required"
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value }
}
