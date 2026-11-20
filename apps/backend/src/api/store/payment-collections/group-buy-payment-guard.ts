import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { GB_PAYMENT_CLOSED } from "../../../modules/group_buy/errors"
import { isGroupBuyPaymentOpen, type MembershipStatus } from "../../../modules/group_buy/utils/membership-payment"

// GB-20 (spec 04 กฎข้อ 42, ADR-024 a — GB-BUG-1): collection ของ draft order group buy สร้าง session ได้เฉพาะช่วงที่รอชำระ
// รันหลัง ownership (ADR-013) และก่อน guardPaidStripeSession (ADR-015) — ไม่เรียก provider ไม่สร้าง/ลบ session
// collection ที่ไม่ผูก order ของ group buy (เช่น collection ของ cart) → next() หลัง query.graph ครั้งเดียว
export async function guardGroupBuyPaymentWindow(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "status", "order.id", "order.metadata"],
    filters: { id: req.params.id },
  })
  const collection = data[0]
  const membershipId = collection?.order?.metadata?.group_buy_membership_id
  if (typeof membershipId !== "string" || !membershipId) {
    return next()
  }

  const { data: memberships } = await query.graph({
    entity: "group_buy_membership",
    fields: ["id", "status", "order_id", "group.pay_deadline_at"],
    filters: { id: membershipId },
  })
  const membership = memberships[0]
  // metadata ของ order ปกติมาจาก cart.metadata (ลูกค้าตั้งได้) → ใช้กฎเฉพาะ membership ของ order นี้จริง
  if (!membership || membership.order_id !== collection.order?.id) {
    return next()
  }
  if (
    !isGroupBuyPaymentOpen(
      membership.status as MembershipStatus,
      membership.group?.pay_deadline_at,
      new Date(),
      collection.status as string
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The payment window for this group buy order is closed",
      GB_PAYMENT_CLOSED
    )
  }
  next()
}
