import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import {
  affectedFractions,
  LedgerEntry,
  OrderForReversal,
  planReversals,
  PlannedReversal,
} from "../../modules/affiliate/utils/reversal"

export type ReversalReason = "canceled" | "refunded" | "returned"
export type ReverseAffiliateCommissionInput =
  | { order_id: string; reason: Exclude<ReversalReason, "refunded"> }
  | { payment_id: string; reason: "refunded" }

// payment.refunded ส่งแค่ payment id → หา order ผ่าน link payment_collection ↔ order ("" = ไม่ผูกกับ order)
export const resolveReversalOrderStep = createStep(
  "resolve-reversal-order",
  async (input: ReverseAffiliateCommissionInput, { container }) => {
    if ("order_id" in input) {
      return new StepResponse(input.order_id)
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "payment",
      fields: ["id", "payment_collection.order.id"],
      filters: { id: input.payment_id },
    })
    return new StepResponse<string>(data[0]?.payment_collection?.order?.id ?? "")
  }
)

// อ่านอย่างเดียว: entry ของ order + สถานะปัจจุบันของ order → reversal ที่ยังขาด (planReversals นับของเดิมแล้ว)
export const prepareAffiliateReversalStep = createStep(
  "prepare-affiliate-reversal",
  async (input: { order_id: string }, { container }) => {
    if (!input.order_id) {
      return new StepResponse<PlannedReversal[]>([])
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const entries = await service.listAffiliateCommissionEntries({ order_id: input.order_id })
    if (!entries.length) {
      return new StepResponse<PlannedReversal[]>([])
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "items.id",
        "items.quantity",
        "items.detail.return_received_quantity",
        "payment_collections.payments.captures.raw_amount",
        "payment_collections.payments.refunds.raw_amount",
      ],
      filters: { id: input.order_id },
    })
    if (!data[0]) {
      return new StepResponse<PlannedReversal[]>([])
    }
    return new StepResponse(
      planReversals(entries as unknown as LedgerEntry[], affectedFractions(data[0] as unknown as OrderForReversal))
    )
  }
)

// insert อย่างเดียว (กฎ 5: ไม่แก้/ลบ entry เดิม) — step เขียนเดียวของ workflow จึงไม่มี compensation ที่ลบ entry
export const createAffiliateReversalEntriesStep = createStep(
  "create-affiliate-reversal-entries",
  async (input: { reversals: PlannedReversal[]; reason: ReversalReason }, { container }) => {
    if (!input.reversals.length) {
      return new StepResponse([])
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const created = await service.createAffiliateCommissionEntries(
      input.reversals.map((r) => ({
        ...r,
        status: "reversed" as const,
        reason: input.reason,
        matures_at: null,
      }))
    )
    return new StepResponse(created)
  }
)

/**
 * spec 05 subscriber refund/cancel/return (AF-4, AC-5): append entry `reversed` ติดลบสำหรับยอดที่ได้รับผลกระทบ
 * ใช้ lock เดียวกับ attribution ของ order (`affiliate-attribution:<order_id>`) ให้ทำทีละรอบ event ซ้ำ/พร้อมกันไม่ reverse ซ้ำ
 */
export const reverseAffiliateCommissionWorkflow = createWorkflow(
  "reverse-affiliate-commission",
  function (input: ReverseAffiliateCommissionInput) {
    const orderId = resolveReversalOrderStep(input)
    const key = transform({ orderId }, ({ orderId }) => `affiliate-attribution:${orderId}`)
    acquireLockStep({ key, timeout: 30, ttl: 60 })

    const reversals = prepareAffiliateReversalStep(transform({ orderId }, ({ orderId }) => ({ order_id: orderId })))
    const created = createAffiliateReversalEntriesStep(
      transform({ reversals, input }, ({ reversals, input }) => ({ reversals, reason: input.reason }))
    )

    releaseLockStep({ key })
    return new WorkflowResponse(created)
  }
)
