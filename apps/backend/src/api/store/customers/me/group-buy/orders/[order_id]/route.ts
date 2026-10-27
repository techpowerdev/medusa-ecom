import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { OrderDetailDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"

const FIELDS = [
  "id",
  "status",
  "units",
  "group.id",
  "group.status",
  "group.ends_at",
  "group.pay_deadline_at",
  "order.id",
  "order.display_id",
  "order.status",
  "order.is_draft_order",
  "order.currency_code",
  "order.total",
  "order.subtotal",
  "order.discount_total",
  "order.tax_total",
  "order.items.id",
  "order.items.title",
  "order.items.variant_title",
  "order.items.thumbnail",
  "order.items.quantity",
  "order.items.unit_price",
  "order.items.total",
  "order.payment_collections.id",
  "order.payment_collections.amount",
  "order.payment_collections.status",
  // captured/refunded ใช้คำนวณ payment_status ด้วย helper ของ Medusa (ไม่คืนใน response)
  "order.payment_collections.captured_amount",
  "order.payment_collections.refunded_amount",
  "order.payment_collections.payment_sessions.id",
  "order.payment_collections.payment_sessions.provider_id",
  "order.payment_collections.payment_sessions.status",
  "order.payment_collections.payment_sessions.amount",
  "order.payment_collections.payment_sessions.data",
]

type Session = {
  id: string
  provider_id: string
  status: string
  amount: unknown
  data?: Record<string, unknown> | null
}
type Collection = {
  id: string
  amount: unknown
  status: string
  payment_sessions?: (Session | null)[]
}
type Item = {
  id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: unknown
  unit_price: unknown
  total: unknown
}
type Row = {
  id: string
  status: string
  units: number
  group: Record<string, unknown>
  order?:
    | (Record<string, unknown> & {
        items?: (Item | null)[]
        payment_collections?: (Collection | null)[]
      })
    | null
}

// GB-8 (spec 04 API รอบ 10, กฎข้อ 21, ADR-016): draft order (หรือ order ที่แปลงแล้ว) ผ่าน membership ของผู้เรียกเท่านั้น
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // ADR-013 ข้อ 2: กรอง customer_id ใน query เดียวกับการหา — ของคนอื่น/ไม่มี/ไม่ใช่ group buy → 404
  const { data } = await query.graph({
    entity: "group_buy_membership",
    fields: FIELDS,
    filters: {
      order_id: req.params.order_id,
      customer_id: req.auth_context.actor_id,
    },
  })
  const row = data[0] as Row | undefined
  const order = row?.order
  if (!row || !order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Group buy order with id: ${req.params.order_id} was not found`)
  }

  const collections = (order.payment_collections ?? []).filter((c): c is Collection => !!c)
  res.set("Cache-Control", "private, no-store")
  res.json({
    membership: { id: row.id, status: row.status, units: row.units },
    group: {
      id: row.group.id,
      status: row.group.status,
      ends_at: row.group.ends_at,
      pay_deadline_at: row.group.pay_deadline_at,
    },
    order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      is_draft_order: order.is_draft_order,
      currency_code: order.currency_code,
      total: order.total,
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      tax_total: order.tax_total,
      // กฎข้อ 24b: คำนวณจากชุด collection ที่กรอง null แล้ว (ชุดเดียวกับใน response) — null ใน array ไม่ทำให้ helper โยน TypeError
      payment_status: getLastPaymentStatus({ ...order, payment_collections: collections } as unknown as OrderDetailDTO),
      items: (order.items ?? [])
        .filter((i): i is Item => !!i)
        .map((i) => ({
          id: i.id,
          title: i.title,
          variant_title: i.variant_title,
          thumbnail: i.thumbnail,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
        })),
      payment_collections: collections.map((c) => ({
        id: c.id,
        amount: c.amount,
        status: c.status,
        payment_sessions: (c.payment_sessions ?? [])
          .filter((s): s is Session => !!s)
          .map((s) => ({
            id: s.id,
            provider_id: s.provider_id,
            status: s.status,
            amount: s.amount,
            // ADR-016 ข้อ 3: เฉพาะ 3 key ของ PaymentIntent — ไม่คืน data ทั้งก้อนของ provider
            data: {
              id: s.data?.id,
              client_secret: s.data?.client_secret,
              status: s.data?.status,
            },
          })),
      })),
    },
  })
}
