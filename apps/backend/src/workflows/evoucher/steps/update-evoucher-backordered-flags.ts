import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { EVOUCHER_BACKORDERED_METADATA_KEY, EvoucherOrder } from "./evoucher-order"

// Order module merge metadata (key ที่ไม่ส่งมาไม่ถูกลบ) — ล้าง key ด้วยค่า "" ตาม convention metadata ของ Medusa
const CLEARED = ""

const restoreFlag = (previous: Record<string, unknown>) => ({
  ...previous,
  [EVOUCHER_BACKORDERED_METADATA_KEY]: previous[EVOUCHER_BACKORDERED_METADATA_KEY] ?? CLEARED,
})

// EV-22 (กฎข้อ 38a): Admin API ของ Medusa คืน `items[].metadata` = `order_item.metadata ?? order_line_item.metadata`
// (transform-order ของ @medusajs/order) และ order_item ของ order ใหม่มี metadata `{}` → ธงที่อยู่แค่ใน line item ไม่ถึงหน้า order
// จึงเขียนธงซ้ำลง order_item ของ line นั้น (update ตรง ไม่สร้าง order change/version ใหม่; merge ทีละ key ไม่ทับ key อื่น)
// EV-25 (กฎข้อ 41): script backfill ใช้ helper นี้กับ order ก่อน EV-22
export const writeEvoucherBackorderedFlag = async (
  orderModule: IOrderModuleService,
  id: string,
  lineMetadata: Record<string, unknown>
) => {
  await orderModule.updateOrderLineItems(id, { metadata: lineMetadata })
  await orderModule.updateOrderItem(
    { item_id: id },
    { metadata: { [EVOUCHER_BACKORDERED_METADATA_KEY]: lineMetadata[EVOUCHER_BACKORDERED_METADATA_KEY] } }
  )
}

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
      await writeEvoucherBackorderedFlag(orderModule, update.id, update.next)
    }
    return new StepResponse(undefined, updates.map(({ id, previous }) => ({ id, previous })))
  },
  async (previous, { container }) => {
    if (!previous?.length) {
      return
    }
    const orderModule = container.resolve(Modules.ORDER)
    for (const item of previous) {
      await writeEvoucherBackorderedFlag(orderModule, item.id, restoreFlag(item.previous))
    }
  }
)
