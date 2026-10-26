import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * EV-10 (spec 02 กฎข้อ 15): pool ที่สร้างก่อน EV-8 ยังมี inventory item `requires_shipping=true` → ตั้งเป็น `false`
 * (checkout digital-only ของ EV-7 พึ่งค่านี้) รันซ้ำได้: แก้เฉพาะ item ที่ยังเป็น `true` และผูก pool เท่านั้น
 */
export default async function evoucherRequiresShipping({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: pools } = await query.graph({ entity: "evoucher_pool", fields: ["variant_id"] })
  if (!pools.length) {
    return
  }
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["inventory_items.inventory.id", "inventory_items.inventory.requires_shipping"],
    filters: { id: pools.map((p) => p.variant_id) },
  })
  const updates = variants
    .flatMap((v) => v.inventory_items ?? [])
    .filter((i) => i?.inventory?.requires_shipping)
    .map((i) => ({ id: i!.inventory!.id, requires_shipping: false }))
  if (!updates.length) {
    return
  }

  await updateInventoryItemsWorkflow(container).run({ input: { updates } })
  logger.info(`Set requires_shipping=false on ${updates.length} e-voucher inventory item(s)`)
}
