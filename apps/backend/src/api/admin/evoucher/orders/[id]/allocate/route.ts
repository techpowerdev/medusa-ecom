import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, OrderStatus } from "@medusajs/framework/utils"
import { allocateAndDeliverEvouchersWorkflow } from "../../../../../../workflows/evoucher/allocate-and-deliver-evouchers"

export type AdminEvoucherAllocateResponse = {
  allocated_line_item_ids: string[]
  backordered_line_item_ids: string[]
  /** line ที่มี code `allocated` แต่ยังไม่ส่งมอบ (อีเมลล้ม) — ลูกค้ายังไม่ได้รับ ต้องใช้ resend (EV-5b) */
  stuck_line_item_ids: string[]
}

// EV-23 (spec 02 กฎข้อ 39, AC-53): Retry allocation ของ order ที่ backordered — ใช้ workflow allocation เดิม
// (lock ต่อ order + ข้าม line ที่มี code แล้ว → ยิงซ้ำ/พร้อมกันไม่ claim/อีเมลซ้ำ; อีเมล admin ใช้ idempotency key เดิม)
// review #472 (กฎข้อ 2): allocate หลัง captured เท่านั้น — order ที่ payment ยัง authorized (เช่น group buy) → 400
// ตรวจที่นี่เป็นการอ่านล้วน (Query) — workflow ตรวจ `canceled` ซ้ำใต้ lock (กฎข้อ 34) จึงไม่มีช่องแจกให้ order ที่เพิ่งยกเลิก
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<AdminEvoucherAllocateResponse>
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "status", "items.variant_id", "payment_collections.payments.captured_at"],
    filters: { id: orderId },
  })
  const order = orders[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order with id: ${orderId} was not found`)
  }
  if (order.status === OrderStatus.CANCELED) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cannot allocate e-voucher codes for a canceled order")
  }
  const variantIds = (order.items ?? []).flatMap((i) => (i?.variant_id ? [i.variant_id] : []))
  const { data: pools } = variantIds.length
    ? await query.graph({ entity: "evoucher_pool", fields: ["id"], filters: { variant_id: variantIds } })
    : { data: [] }
  if (!pools.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order has no e-voucher items")
  }
  const captured = (order.payment_collections ?? []).some((pc) =>
    (pc?.payments ?? []).some((p) => !!p?.captured_at)
  )
  if (!captured) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot allocate e-voucher codes before the order payment is captured"
    )
  }

  const { result } = await allocateAndDeliverEvouchersWorkflow(req.scope).run({
    input: { order_id: orderId, admin_email: process.env.EVOUCHER_ADMIN_EMAIL?.trim() || undefined },
  })
  res.json({
    allocated_line_item_ids: result.allocated.map((a) => a.line_item_id),
    backordered_line_item_ids: result.backordered,
    stuck_line_item_ids: result.stuck,
  })
}
