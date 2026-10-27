// GB-6b: logic ล้วนของหน้ารายละเอียดแคมเปญ (ไม่ import sdk เพื่อให้ unit test ได้)
import type { GroupMode, TargetType } from "./group-buy-form"

export type CampaignStatus = "draft" | "active" | "ended"

// spec 04 กฎข้อ 10: draft → active → ended; ลบได้เฉพาะ draft; admin สร้าง pool ได้เมื่อแคมเปญ active และ mode อนุญาต pool
export const campaignActions = (c: { status: CampaignStatus; group_mode: GroupMode }) => ({
  activate: c.status === "draft",
  end: c.status === "active",
  remove: c.status === "draft",
  createPool: c.status === "active" && c.group_mode !== "team",
})

type Progress = { progress_orders: number; progress_units: number; progress_people: number }

export const groupProgress = (
  g: Progress,
  c: { target_type: TargetType; target_value: number }
) => `${g[`progress_${c.target_type}`]} / ${c.target_value} ${c.target_type}`

// GB-6c (AC-35): succeed/fail แบบ manual เฉพาะกลุ่ม open
export const canSetGroupOutcome = (g: { status: "open" | "succeeded" | "failed" }) => g.status === "open"

// AC-35: draft order อยู่ที่ /draft-orders/:id (plugin @medusajs/draft-order ของ dashboard 2.22.1) แปลงแล้วอยู่ที่ /orders/:id
export const orderAdminPath = (m: { order_id: string; order: { is_draft_order: boolean } | null }) =>
  m.order?.is_draft_order === false ? `/orders/${m.order_id}` : `/draft-orders/${m.order_id}`

// review #114: customer เป็น null เมื่อไม่พบลูกค้าใน Customer module (เช่นถูกลบ)
export const customerLabel = (m: { customer_id: string; customer: { email: string } | null }) =>
  m.customer?.email ?? `${m.customer_id} (deleted)`
