import { sdk } from "./client"
import type { AllocateResult } from "./evoucher-allocate"
import type { CodeStatus } from "./evoucher-status"

export { CODE_STATUSES, type CodeStatus } from "./evoucher-status"

// รูปร่าง response ของ admin API e-voucher (src/api/admin/evoucher/*)
export const STATUS_COLOR: Record<CodeStatus, "green" | "orange" | "blue" | "grey"> = {
  available: "green",
  allocated: "orange",
  delivered: "blue",
  void: "grey",
}

export type Partner = {
  id: string
  name: string
  logo_url: string | null
  terms_url: string | null
  support_contact: string | null
}

export type Pool = {
  id: string
  variant_id: string
  name: string
  face_value: number | string | null
  validity_note: string | null
  how_to_use: string
  low_stock_threshold: number
  partner: { id: string; name: string }
  code_counts: Record<CodeStatus, number>
  // EV-20 (กฎข้อ 36c): จำนวน code ทุกสถานะ — 0 = pool ว่าง (ไม่ขึ้น low stock)
  total_codes: number
  low_stock: boolean
}

export type MaskedCode = {
  id: string
  code: string
  has_pin: boolean
  status: CodeStatus
  expires_at: string | null
  batch_ref?: string
  order_id?: string | null
  delivered_at: string | null
  delivered_to_email: string | null
  pool?: { id: string; name: string; partner?: { name: string } }
}

export type RevealedCode = {
  id: string
  code: string
  pin: string | null
  status: CodeStatus
  expires_at: string | null
}

export type ImportResult = { inserted: number; skipped_duplicates: number; batch_ref: string }

export type PartnerInput = {
  name: string
  logo_url?: string | null
  terms_url?: string | null
  support_contact?: string | null
}

export type PoolInput = {
  partner_id: string
  variant_id: string
  name: string
  how_to_use: string
  face_value?: number | null
  validity_note?: string | null
  low_stock_threshold?: number
}

export const evoucherKeys = {
  partners: ["evoucher", "partners"] as const,
  pools: ["evoucher", "pools"] as const,
  pool: (id: string) => ["evoucher", "pools", id] as const,
  poolByVariant: (variantId: string) => ["evoucher", "pools", "variant", variantId] as const,
  codes: (poolId: string) => ["evoucher", "codes", poolId] as const,
  orderCodes: (orderId: string) => ["evoucher", "order-codes", orderId] as const,
}

const BASE = "/admin/evoucher"

export const evoucherApi = {
  // ADM-5 (spec 08 กฎ 11): ผู้เรียกกำหนดหน้าเอง — ตาราง Partners แบ่งหน้าตาม URL
  listPartners: (query: { limit: number; offset: number }) =>
    sdk.client.fetch<{ partners: Partner[]; count: number }>(`${BASE}/partners`, {
      query: { ...query, order: "name" },
    }),
  createPartner: (body: PartnerInput) =>
    sdk.client.fetch<{ partner: Partner }>(`${BASE}/partners`, { method: "POST", body }),
  updatePartner: (id: string, body: PartnerInput) =>
    sdk.client.fetch<{ partner: Partner }>(`${BASE}/partners/${id}`, { method: "POST", body }),
  deletePartner: (id: string) =>
    sdk.client.fetch(`${BASE}/partners/${id}`, { method: "DELETE" }),

  listPools: (query: { limit: number; offset: number; variant_id?: string }) =>
    sdk.client.fetch<{ pools: Pool[]; count: number }>(`${BASE}/pools`, { query }),
  retrievePool: (id: string) => sdk.client.fetch<{ pool: Pool }>(`${BASE}/pools/${id}`),
  createPool: (body: PoolInput) =>
    sdk.client.fetch<{ pool: Pool }>(`${BASE}/pools`, { method: "POST", body }),
  // EV-20/EV-21 (กฎข้อ 36–37): 400 `not_allowed` เมื่อมี code ถูกส่ง/จอง หรือมี reservation ค้าง
  deletePool: (id: string) =>
    sdk.client.fetch(`${BASE}/pools/${id}`, { method: "DELETE" }),

  importCodes: (poolId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return sdk.client.fetch<ImportResult>(`${BASE}/pools/${poolId}/import`, {
      method: "POST",
      // ให้ browser ใส่ multipart boundary เอง
      headers: { "content-type": null },
      body: form,
    })
  },
  listCodes: (poolId: string, query: { limit: number; offset: number; status?: CodeStatus }) =>
    sdk.client.fetch<{ codes: MaskedCode[]; count: number }>(`${BASE}/pools/${poolId}/codes`, {
      query,
    }),
  revealCode: (id: string) =>
    sdk.client.fetch<{ code: RevealedCode }>(`${BASE}/codes/${id}/reveal`),
  listOrderCodes: (orderId: string) =>
    sdk.client.fetch<{ codes: MaskedCode[] }>(`${BASE}/orders/${orderId}/codes`),
  resendOrderEmail: (orderId: string) =>
    sdk.client.fetch<{ order_id: string; code_count: number }>(`${BASE}/orders/${orderId}/resend`, {
      method: "POST",
    }),
  // EV-24 (กฎข้อ 40): Retry allocation ของ line ที่ backordered (route EV-23 กฎข้อ 39)
  allocateOrder: (orderId: string) =>
    sdk.client.fetch<AllocateResult>(`${BASE}/orders/${orderId}/allocate`, { method: "POST" }),
}
