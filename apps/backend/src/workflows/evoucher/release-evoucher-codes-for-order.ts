import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"
import {
  EVOUCHER_ORDER_LOCK_TIMEOUT,
  EVOUCHER_ORDER_LOCK_TTL,
  evoucherOrderLockKey,
} from "./steps/evoucher-order"

type ReleasedCode = {
  id: string
  order_id: string | null
  order_line_item_id: string | null
  customer_id: string | null
  allocated_at: Date | null
}

const RELEASED_FIELDS = {
  status: "available" as const,
  order_id: null,
  order_line_item_id: null,
  customer_id: null,
  allocated_at: null,
}

/**
 * กฎข้อ 32a/c: code `allocated` ของ order กลับเป็น `available` และล้างฟิลด์ของ order — `delivered` ไม่ถูกแตะ;
 * update มีเงื่อนไข `order_id` + `status='allocated'` จึง idempotent (event ซ้ำไม่มีแถวให้เปลี่ยน) และไม่แตะ code ที่ order อื่น claim แล้ว
 * กฎข้อ 32d: compensation คืนค่าเดิมเฉพาะแถวที่ยัง `available` และไม่มี order (ยังไม่ถูก order อื่น claim)
 */
export const releaseAllocatedEvoucherCodesStep = createStep(
  "release-allocated-evoucher-codes",
  async (input: { order_id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const allocated = await service.listEvoucherCodes(
      { order_id: input.order_id, status: "allocated" },
      { select: ["id", "order_id", "order_line_item_id", "customer_id", "allocated_at"] }
    )
    if (!allocated.length) {
      return new StepResponse({ released: 0 }, [] as ReleasedCode[])
    }
    const updated = await service.updateEvoucherCodes({
      selector: { id: allocated.map((c) => c.id), order_id: input.order_id, status: "allocated" },
      data: RELEASED_FIELDS,
    })
    const releasedIds = new Set(updated.map((c) => c.id))
    const released: ReleasedCode[] = allocated
      .filter((c) => releasedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        order_id: c.order_id,
        order_line_item_id: c.order_line_item_id,
        customer_id: c.customer_id,
        allocated_at: c.allocated_at,
      }))
    return new StepResponse({ released: released.length }, released)
  },
  async (released, { container }) => {
    if (!released?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    for (const { id, ...original } of released) {
      await service.updateEvoucherCodes({
        selector: { id, status: "available", order_id: null },
        data: { ...original, status: "allocated" },
      })
    }
  }
)

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
