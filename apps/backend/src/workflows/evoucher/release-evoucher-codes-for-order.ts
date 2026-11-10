import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import {
  EVOUCHER_ORDER_LOCK_TIMEOUT,
  EVOUCHER_ORDER_LOCK_TTL,
  evoucherOrderLockKey,
} from "./steps/evoucher-order"
import { releaseAllocatedEvoucherCodesStep } from "./steps/release-allocated-evoucher-codes"

export type ReleaseEvoucherCodesForOrderInput = { order_id: string }

/**
 * EV-16 (spec 02 กฎข้อ 32, AC-46): หลัง `order.canceled` ปล่อย code `allocated` ที่ยังไม่ส่งมอบกลับเข้า pool
 * ถือ lock ต่อ order ร่วมกับ allocation (EV-4) และ resend (EV-5b) — กฎข้อ 21/27
 * กฎข้อ 32e: ไม่ปรับ inventory — Medusa คืน stock ตอนยกเลิก fulfillment และลบ reservation ตอนยกเลิก order แล้ว
 */
export const releaseEvoucherCodesForOrderWorkflow = createWorkflow(
  "release-evoucher-codes-for-order",
  function (input: ReleaseEvoucherCodesForOrderInput) {
    const lockKey = transform({ input }, ({ input }) => evoucherOrderLockKey(input.order_id))
    // กฎข้อ 27a: owner ต่อ run — release ลบเฉพาะ lock ของ run นี้
    const lockOwnerId = transform({ input }, (_, { context }) => `evoucher-release:${context.transactionId}`)
    acquireLockStep({
      key: lockKey,
      ownerId: lockOwnerId,
      timeout: EVOUCHER_ORDER_LOCK_TIMEOUT,
      ttl: EVOUCHER_ORDER_LOCK_TTL,
    })

    const result = releaseAllocatedEvoucherCodesStep({ order_id: input.order_id })

    releaseLockStep({ key: lockKey, ownerId: lockOwnerId })
    return new WorkflowResponse(result)
  }
)
