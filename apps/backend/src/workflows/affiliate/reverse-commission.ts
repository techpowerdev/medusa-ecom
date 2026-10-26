import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
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

// DB ล้มชั่วคราว → engine ลอง step ใหม่ทุก 10 วินาที สูงสุด 30 ครั้ง (แบบ FS-8/FS-11) — workflow idempotent อยู่แล้ว
export const REVERSAL_RETRY = { maxRetries: 30, retryInterval: 10 }

// payment.refunded ส่งแค่ payment id → payment_collection_id → link order_payment_collection แบบเดียวกับ
// refundPaymentWorkflow ของ Medusa ("" = ไม่ผูกกับ order)
export const resolveReversalOrderStep = createStep(
  "resolve-reversal-order",
  async (input: ReverseAffiliateCommissionInput, { container }) => {
    if ("order_id" in input) {
      return new StepResponse(input.order_id)
    }
    const [payment] = await container
      .resolve(Modules.PAYMENT)
      .listPayments({ id: input.payment_id }, { select: ["id", "payment_collection_id"] })
    if (!payment?.payment_collection_id) {
      return new StepResponse("")
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order_payment_collection",
      fields: ["order_id"],
      filters: { payment_collection_id: payment.payment_collection_id },
    })
    return new StepResponse<string>((data[0] as { order_id?: string } | undefined)?.order_id ?? "")
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
        "items.detail.return_dismissed_quantity",
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
    const orderId = resolveReversalOrderStep(input).config(REVERSAL_RETRY)

    // payment ที่ไม่ผูกกับ order → ไม่ขอ lock/ไม่ทำอะไร; when ที่ .then() คืนค่าต้องมีชื่อคงที่ (บทเรียน FS-11)
    const created = when("affiliate-reversal-has-order", { orderId }, ({ orderId }) => !!orderId).then(() => {
      const key = transform({ orderId }, ({ orderId }) => `affiliate-attribution:${orderId}`)
      acquireLockStep({ key, timeout: 30, ttl: 60 })

      const reversals = prepareAffiliateReversalStep(
        transform({ orderId }, ({ orderId }) => ({ order_id: orderId }))
      ).config(REVERSAL_RETRY)
      const entries = createAffiliateReversalEntriesStep(
        transform({ reversals, input }, ({ reversals, input }) => ({ reversals, reason: input.reason }))
      ).config(REVERSAL_RETRY)

      releaseLockStep({ key })
      return entries
    })

    return new WorkflowResponse(transform({ created }, ({ created }) => created ?? []))
  }
)
