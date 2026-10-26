import { MathBN } from "@medusajs/framework/utils"

// CORE-11 (spec 01 กฎข้อ 20): อีเมล shipped แสดงเฉพาะ item และจำนวนที่อยู่ใน fulfillment ของ shipment.created นั้น
// ไม่คง total/ราคาของ line ไว้ เพราะเป็นยอดของจำนวนทั้ง order ไม่ใช่จำนวนที่ส่งรอบนี้
//
// createOrderFulfillmentWorkflow ของ Medusa สร้าง fulfillment item 1 แถวต่อ inventory item ของ variant
// โดย quantity = required_quantity × จำนวนที่ส่ง (variant ที่ไม่ manage inventory ได้ 1 แถว ไม่มี inventory_item_id)
// → จัดกลุ่มตาม (line_item_id, inventory_item_id) หารด้วย required_quantity แล้วใช้ค่าสูงสุดของ line
// (ทุกกลุ่มของ line เดียวกันควรได้จำนวนชิ้นเท่ากัน)

type Quantity = number | string | { toString(): string } | null | undefined

type OrderItem = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  variant?: {
    inventory_items?: ({ inventory_item_id?: string | null; required_quantity?: Quantity } | null)[] | null
  } | null
}

type FulfillmentItem = {
  line_item_id?: string | null
  inventory_item_id?: string | null
  quantity?: Quantity
}

export type ShippedItem = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  quantity: number
}

type BN = ReturnType<typeof MathBN.convert>

const toBN = (value: Quantity): BN => MathBN.convert(String(value ?? 0))

export const toShippedItems = (
  orderItems: (OrderItem | null)[] | null | undefined,
  fulfillmentItems: (FulfillmentItem | null)[] | null | undefined
): ShippedItem[] => {
  // line_item_id → inventory_item_id ("" = ไม่มี) → ผลรวม quantity ของ fulfillment item
  const rowsByLine = new Map<string, Map<string, BN>>()
  for (const item of fulfillmentItems ?? []) {
    if (!item?.line_item_id) {
      continue
    }
    const byInventory = rowsByLine.get(item.line_item_id) ?? new Map<string, BN>()
    const key = item.inventory_item_id ?? ""
    byInventory.set(key, MathBN.add(byInventory.get(key) ?? MathBN.convert(0), toBN(item.quantity)))
    rowsByLine.set(item.line_item_id, byInventory)
  }

  return (orderItems ?? [])
    .filter((item): item is OrderItem => !!item && rowsByLine.has(item.id))
    .map(({ id, title, product_title, variant_title, variant }) => {
      let units: BN = MathBN.convert(0)
      for (const [inventoryItemId, quantity] of rowsByLine.get(id)!) {
        const required = variant?.inventory_items?.find(
          (ii) => !!inventoryItemId && ii?.inventory_item_id === inventoryItemId
        )?.required_quantity
        const perUnit = required ? toBN(required) : MathBN.convert(1)
        const lineUnits = MathBN.gt(perUnit, 0) ? MathBN.div(quantity, perUnit) : quantity
        units = MathBN.max(units, lineUnits)
      }

      return { id, title, product_title, variant_title, quantity: units.toNumber() }
    })
}
