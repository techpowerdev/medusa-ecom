import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { OrderDetailDTO } from "@medusajs/framework/types"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"

type Row = {
  customer_id: string
  order?: (Record<string, unknown> & { payment_collections?: unknown[] }) | null
} & Record<string, unknown>

// GB-6c (spec 04 API, AC-34): membership ของกลุ่ม + order (read-only link) + อีเมลลูกค้า (query แยกชุดเดียว — ไม่มี link)
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // กลุ่มไม่มีจริง → 404
  await query.graph(
    { entity: "group_buy_group", fields: ["id"], filters: { id: req.params.id } },
    { throwIfKeyNotFound: true }
  )

  const { data, metadata } = await query.graph({
    entity: "group_buy_membership",
    fields: req.queryConfig.fields,
    filters: { group_id: req.params.id },
    pagination: { ...req.queryConfig.pagination, order: { joined_at: "ASC", id: "ASC" } },
  })
  const rows = data as Row[]

  const customerIds = [...new Set(rows.map((m) => m.customer_id))]
  const { data: customers } = customerIds.length
    ? await query.graph({ entity: "customer", fields: ["id", "email"], filters: { id: customerIds } })
    : { data: [] }
  const emailOf = new Map(customers.map((c) => [c.id, c.email]))

  const memberships = rows.map(({ order, ...m }) => {
    const email = emailOf.get(m.customer_id)
    return {
      ...m,
      customer: email ? { email } : null,
      // payment_status ไม่ใช่ column ของ order — คำนวณด้วย helper เดียวกับ route order ของ Medusa
      order: order
        ? {
            status: order.status,
            is_draft_order: order.is_draft_order,
            payment_status: getLastPaymentStatus(order as unknown as OrderDetailDTO),
            total: order.total,
          }
        : null,
    }
  })

  res.json({ memberships, count: metadata?.count ?? memberships.length })
}
