import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EvoucherLine, EvoucherOrder, EvoucherOrderItem } from "./evoucher-order"

// line item ของ order ที่ variant มี EvoucherPool (กฎข้อ 1)
export const resolveEvoucherLinesStep = createStep(
  "resolve-evoucher-lines",
  async (input: { order: EvoucherOrder }, { container }) => {
    const items = (input.order.items ?? []).filter((i): i is EvoucherOrderItem => !!i?.variant_id)
    if (!items.length) {
      return new StepResponse([] as EvoucherLine[])
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const { data: pools } = await query.graph({
      entity: "evoucher_pool",
      fields: ["id", "name", "variant_id"],
      filters: { variant_id: items.map((i) => i.variant_id!) },
    })
    const byVariant = new Map(pools.map((p) => [p.variant_id, p]))
    const lines: EvoucherLine[] = []
    for (const item of items) {
      const pool = byVariant.get(item.variant_id!)
      if (!pool) {
        continue
      }
      // กฎข้อ 1 (EV-11): voucher product ต้องไม่มี shipping profile — ไม่บังคับที่นี่ (ไม่ทำให้ order ล้ม) แต่ห้ามเงียบ
      const product = item.variant?.product
      if (product?.shipping_profile?.id) {
        logger.warn(
          `evoucher: order ${input.order.id} line item ${item.id} (pool ${pool.id}, product ${product.id}, ` +
            `variant ${item.variant_id}) is a voucher whose product has shipping profile ` +
            `${product.shipping_profile.id}, expected none`
        )
      }
      lines.push({
        line_item_id: item.id,
        pool_id: pool.id,
        pool_name: pool.name,
        title: item.title ?? "",
        quantity: Number(item.quantity),
      })
    }
    return new StepResponse(lines)
  }
)
