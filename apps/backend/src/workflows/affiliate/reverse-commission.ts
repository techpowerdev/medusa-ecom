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
// lock_owner_id: ผู้เรียกที่ถือ lock ของ order อยู่แล้ว (maturity job กฎ 32a) ส่งต่อให้ workflow ขอซ้ำด้วย owner เดิมแล้วปล่อยเอง
export type ReverseAffiliateCommissionInput = (
  | { order_id: string; reason: Exclude<ReversalReason, "refunded"> }
  | { payment_id: string; reason: "refunded" }
) & { lock_owner_id?: string }

// DB ล้มชั่วคราว → engine ลอง step ใหม่ (แบบ FS-8/FS-11) — workflow idempotent อยู่แล้ว
// หา order (นอก lock): ทุก 10 วินาที สูงสุด 30 ครั้ง
export const REVERSAL_RETRY = { maxRetries: 30, retryInterval: 10 }
// step ใต้ lock: retry รวม (4 × 10 วินาที) ต้องจบก่อน lock หมดอายุ (REVERSAL_LOCK_TTL) ไม่ให้อีก run เข้ามาคำนวณซ้อน
export const REVERSAL_LOCKED_RETRY = { maxRetries: 4, retryInterval: 10 }
export const REVERSAL_LOCK_TTL = 60

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

// กฎ 5 + 28: อ่าน entry + สถานะปัจจุบันของ order → คำนวณส่วนต่าง → insert entry `reversed` ใน step เดียว
// (retry คำนวณใหม่จาก ledger ล่าสุด จึงไม่ insert ซ้ำแม้รอบก่อน commit แล้วแต่รายงานล้ม); ไม่มี compensation ที่ลบ entry
export const reverseAffiliateCommissionEntriesStep = createStep(
  "reverse-affiliate-commission-entries",
  async (input: { order_id: string; reason: ReversalReason }, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const entries = await service.listAffiliateCommissionEntries({ order_id: input.order_id })
    if (!entries.length) {
      return new StepResponse([])
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
    const reversals: PlannedReversal[] = data[0]
      ? planReversals(entries as unknown as LedgerEntry[], affectedFractions(data[0] as unknown as OrderForReversal))
      : []
    if (!reversals.length) {
      return new StepResponse([])
    }
    const created = await service.createAffiliateCommissionEntries(
      reversals.map((r) => ({ ...r, status: "reversed" as const, reason: input.reason, matures_at: null }))
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
      const ownerId = transform({ input }, ({ input }) => input.lock_owner_id)
      acquireLockStep({ key, timeout: 30, ttl: REVERSAL_LOCK_TTL, ownerId })

      const entries = reverseAffiliateCommissionEntriesStep(
        transform({ orderId, input }, ({ orderId, input }) => ({ order_id: orderId, reason: input.reason }))
      ).config(REVERSAL_LOCKED_RETRY)

      releaseLockStep({ key, ownerId })
      return entries
    })

    return new WorkflowResponse(transform({ created }, ({ created }) => created ?? []))
  }
)
