import { z } from "zod"
import { isAccountNumber, normalizeAccountNumber } from "../../modules/affiliate/utils/account-number"
import type { Affiliate } from "./affiliate"

// AF-12b (spec 05 กฎ 37b): action สถานะเดียวต่อแถวตามสถานะ affiliate — suspend ต้องยืนยันด้วย usePrompt
// ADM-8b: อยู่ใน ActionMenu ของแถว (menuitem หาด้วย label — spec 08 กฎ 10)
export type AffiliateAction = {
  label: string
  status: Affiliate["status"]
  confirm: boolean
}

const ACTIONS: Record<Affiliate["status"], AffiliateAction> = {
  pending: { label: "Approve", status: "active", confirm: false },
  active: { label: "Suspend", status: "suspended", confirm: true },
  suspended: { label: "Reactivate", status: "active", confirm: false },
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

const required = z.string().trim().min(1, "Required")

/** validator ฝั่ง admin: trim ทุกช่อง และทั้ง 3 ช่องต้องไม่ว่าง — ส่งเฉพาะ 3 key นี้;
 * account_number ตัด `-`/ช่องว่างแล้วต้องเป็นตัวเลข 10–12 หลัก (AF-15 กฎ 39a — ตรงกับ validator ของ API) */
export const payoutInfoSchema = z.object({
  bank_name: required,
  account_name: required,
  account_number: required.transform(normalizeAccountNumber).refine(isAccountNumber, "Must be 10–12 digits"),
})
