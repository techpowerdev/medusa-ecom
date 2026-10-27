import { sdk } from "./client"

// รูปร่าง response ของ admin API affiliate (src/api/admin/affiliate/*, AF-5/AF-9)
export type Program = {
  id: string
  name: string
  status: "draft" | "published" | "ended"
  starts_at: string
  ends_at: string
  commission_value: number
  hold_days: number
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

// AF-12b (กฎ 37b): อนุมัติ/ระงับ affiliate และแก้ข้อมูลรับเงินผ่าน POST /admin/affiliate/affiliates/:id (AF-5)
export type AdminAffiliate = Affiliate & { payout_info: Record<string, unknown> | null }

export const updateAffiliate = (
  id: string,
  body: { status?: Affiliate["status"]; payout_info?: Record<string, string> | null },
) => sdk.client.fetch<{ affiliate: AdminAffiliate }>(`/admin/affiliate/affiliates/${id}`, { method: "POST", body })
