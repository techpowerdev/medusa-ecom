import { sdk } from "./client"

// รูปร่าง response ของ admin API affiliate (src/api/admin/affiliate/*, AF-5/AF-9)
export type ProgramStatus = "draft" | "published" | "ended"

export type ProgramScope = {
  all?: boolean
  variant_ids?: string[]
  collection_ids?: string[]
  category_ids?: string[]
}

export type Program = {
  id: string
  name: string
  status: ProgramStatus
  starts_at: string
  ends_at: string
  announce_text: string | null
  commission_value: number | string
  attribution_window_days: number
  hold_days: number
  cap_per_order: number | string | null
  scope: ProgramScope
}

export type Affiliate = {
  id: string
  email: string
  name: string
  code: string
  status: "pending" | "active" | "suspended"
  created_at: string
}

export type CommissionEntry = {
  id: string
  affiliate_id: string
  order_id: string
  amount: number
  currency: string
  status: "pending" | "approved" | "reversed" | "paid"
  created_at: string
}

export type Payout = {
  id: string
  affiliate_id: string
  amount: number
  currency: string
  period_from: string
  period_to: string
  status: "draft" | "paid"
  paid_at: string | null
}

export type ListResponse<K extends string, T> = { [key in K]: T[] } & {
  count: number
}

export const affiliateKeys = {
  list: (resource: string) => ["affiliate", resource] as const,
}

export const listAffiliateResource = <K extends string, T>(
  resource: K,
  query: { limit: number; offset: number },
) =>
  sdk.client.fetch<ListResponse<K, T>>(`/admin/affiliate/${resource}`, {
    query,
  })

// AF-9: route ยกเลิก payout draft (soft-delete, Q9)
export const cancelPayout = (id: string) =>
  sdk.client.fetch(`/admin/affiliate/payouts/${id}`, { method: "DELETE" })

// AF-12a (กฎ 37a): สร้าง/แก้/ลบโปรแกรมผ่าน admin API ของ AF-5
export type ProgramBody = Omit<Program, "id" | "status" | "commission_value" | "cap_per_order"> & {
  status: ProgramStatus
  commission_value: number
  cap_per_order: number | null
}

export const createProgram = (body: ProgramBody) =>
  sdk.client.fetch<{ program: Program }>("/admin/affiliate/programs", { method: "POST", body })

export const updateProgram = (id: string, body: ProgramBody) =>
  sdk.client.fetch<{ program: Program }>(`/admin/affiliate/programs/${id}`, { method: "POST", body })

export const deleteProgram = (id: string) =>
  sdk.client.fetch(`/admin/affiliate/programs/${id}`, { method: "DELETE" })

// AF-12b (กฎ 37b): อนุมัติ/ระงับ affiliate และแก้ข้อมูลรับเงินผ่าน POST /admin/affiliate/affiliates/:id (AF-5)
export type AdminAffiliate = Affiliate & { payout_info: Record<string, unknown> | null }

export const updateAffiliate = (
  id: string,
  body: { status?: Affiliate["status"]; payout_info?: Record<string, string> | null },
) => sdk.client.fetch<{ affiliate: AdminAffiliate }>(`/admin/affiliate/affiliates/${id}`, { method: "POST", body })
