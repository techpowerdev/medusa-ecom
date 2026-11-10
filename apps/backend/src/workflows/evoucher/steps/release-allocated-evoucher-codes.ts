import type { MedusaContainer } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService from "../../../modules/evoucher/service"

/** ค่าเดิมของแถวที่ถูกปล่อย — ใช้คืนค่าใน compensation (กฎข้อ 32d) */
export type ReleasedEvoucherCode = {
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
 */
export const releaseAllocatedEvoucherCodes = async (
  input: { order_id: string },
  { container }: { container: MedusaContainer }
) => {
  const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
  const allocated = await service.listEvoucherCodes(
    { order_id: input.order_id, status: "allocated" },
    { select: ["id", "order_id", "order_line_item_id", "customer_id", "allocated_at"] }
  )
  if (!allocated.length) {
    return new StepResponse({ released: 0 }, [] as ReleasedEvoucherCode[])
  }
  const updated = await service.updateEvoucherCodes({
    selector: { id: allocated.map((c) => c.id), order_id: input.order_id, status: "allocated" },
    data: RELEASED_FIELDS,
  })
  const releasedIds = new Set(updated.map((c) => c.id))
  const released: ReleasedEvoucherCode[] = allocated
    .filter((c) => releasedIds.has(c.id))
    .map((c) => ({
      id: c.id,
      order_id: c.order_id,
      order_line_item_id: c.order_line_item_id,
      customer_id: c.customer_id,
      allocated_at: c.allocated_at,
    }))
  return new StepResponse({ released: released.length }, released)
}

/** กฎข้อ 32d: คืนค่าเดิมเฉพาะแถวที่ยัง `available` และไม่มี order (ยังไม่ถูก order อื่น claim) */
export const restoreReleasedEvoucherCodes = async (
  released: ReleasedEvoucherCode[] | undefined,
  { container }: { container: MedusaContainer }
) => {
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

export const releaseAllocatedEvoucherCodesStep = createStep(
  "release-allocated-evoucher-codes",
  releaseAllocatedEvoucherCodes,
  restoreReleasedEvoucherCodes
)
