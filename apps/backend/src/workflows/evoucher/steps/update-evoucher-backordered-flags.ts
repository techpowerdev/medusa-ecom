import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { EVOUCHER_BACKORDERED_METADATA_KEY, EvoucherOrder } from "./evoucher-order"

// Order module merge metadata (key ที่ไม่ส่งมาไม่ถูกลบ) — ล้าง key ด้วยค่า "" ตาม convention metadata ของ Medusa
const CLEARED = ""

const restoreFlag = (previous: Record<string, unknown>) => ({
  ...previous,
  [EVOUCHER_BACKORDERED_METADATA_KEY]: previous[EVOUCHER_BACKORDERED_METADATA_KEY] ?? CLEARED,
})

// backordered → ตั้ง flag ใน metadata ของ line item (ไม่ทำให้ order ล้ม); line item ที่ส่งมอบได้แล้ว → ล้าง flag เดิม
export const updateEvoucherBackorderedFlagsStep = createStep(
  "update-evoucher-backordered-flags",
  async (
    input: { order: EvoucherOrder; backordered: string[]; allocated: string[] },
    { container }
  ) => {
    const updates: { id: string; previous: Record<string, unknown>; next: Record<string, unknown> }[] = []
    for (const item of input.order.items ?? []) {
      if (!item) {
        continue
      }
      const previous = item.metadata ?? {}
      if (input.backordered.includes(item.id) && previous[EVOUCHER_BACKORDERED_METADATA_KEY] !== true) {
        updates.push({ id: item.id, previous, next: { ...previous, [EVOUCHER_BACKORDERED_METADATA_KEY]: true } })
      } else if (input.allocated.includes(item.id) && previous[EVOUCHER_BACKORDERED_METADATA_KEY]) {
        updates.push({ id: item.id, previous, next: { ...previous, [EVOUCHER_BACKORDERED_METADATA_KEY]: CLEARED } })
      }
    }
    const orderModule = container.resolve(Modules.ORDER)
    for (const update of updates) {
      await orderModule.updateOrderLineItems(update.id, { metadata: update.next })
    }
    return new StepResponse(undefined, updates.map(({ id, previous }) => ({ id, previous })))
  },
  async (previous, { container }) => {
    if (!previous?.length) {
      return
    }
    const orderModule = container.resolve(Modules.ORDER)
    for (const item of previous) {
      await orderModule.updateOrderLineItems(item.id, { metadata: restoreFlag(item.previous) })
    }
  }
)
