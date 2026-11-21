import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { OrderDetailDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"

type Row = {
  campaign_id: string
  order?: Record<string, unknown> | null
} & Record<string, unknown>

// fields กำหนดใน route — Medusa ตัด relation `order` ออกจาก fields ของ validateAndTransformQuery ทุก store route
// (`http.restrictedFields.store`) และ route นี้ไม่รับ `fields` จาก client อยู่แล้ว
const FIELDS = [
  "id",
  "status",
  "units",
  "joined_at",
  "order_id",
  "campaign_id",
  "group.id",
  "group.status",
  "group.ends_at",
  "group.pay_deadline_at",
  "group.join_token",
  "order.id",
  "order.display_id",
  "order.status",
  "order.is_draft_order",
  "order.currency_code",
  "order.total",
  // GB-22 (spec 04 กฎข้อ 45b): ใช้คำนวณ payment_status ด้วย helper ของ Medusa แบบ route รายตัว (ไม่คืน collection ใน response)
  "order.payment_collections.amount",
  "order.payment_collections.status",
  "order.payment_collections.captured_amount",
  "order.payment_collections.refunded_amount",
]

// GB-8 (spec 04 API รอบ 10, กฎข้อ 21, ADR-016): membership ของผู้เรียกเท่านั้น ใหม่สุดก่อน (รวม cancelled) — อ่านอย่างเดียว
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "group_buy_membership",
    fields: FIELDS,
    filters: { customer_id: req.auth_context.actor_id },
    pagination: {
      ...req.queryConfig.pagination,
      order: { joined_at: "DESC", id: "DESC" },
    },
  })
  const rows = data as Row[]

  // Query ต่อ membership → `campaign` ไม่ได้ (ชื่อชนกับ entity campaign ของ Promotion module) จึงอ่านแคมเปญแยกชุดเดียว ไม่ยิงต่อแถว
  const campaignIds = [...new Set(rows.map((m) => m.campaign_id))]
  const { data: campaigns } = campaignIds.length
    ? await query.graph({
        entity: "group_buy_campaign",
        fields: ["id", "name"],
        filters: { id: campaignIds },
      })
    : { data: [] }
  const campaignOf = new Map(campaigns.map((c) => [c.id, { id: c.id, name: c.name }]))

  const memberships = rows.map(({ order, campaign_id, ...m }) => ({
    ...m,
    campaign: campaignOf.get(campaign_id) ?? null,
    order: order
      ? {
          id: order.id,
          display_id: order.display_id,
          status: order.status,
          is_draft_order: order.is_draft_order,
          currency_code: order.currency_code,
          total: order.total,
          // ADR-016 ภาคผนวก 2026-11-21: กรอง null ก่อนคำนวณแบบเดียวกับ route รายตัว (กฎข้อ 24b)
          payment_status: getLastPaymentStatus({
            ...order,
            payment_collections: ((order.payment_collections as unknown[] | undefined) ?? []).filter(Boolean),
          } as unknown as OrderDetailDTO),
        }
      : null,
  }))

  res.set("Cache-Control", "private, no-store")
  res.json({ memberships, count: metadata?.count ?? memberships.length })
}
