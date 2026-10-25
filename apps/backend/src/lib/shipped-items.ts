import { MathBN } from "@medusajs/framework/utils"

// CORE-11 (spec 01 กฎข้อ 20): อีเมล shipped แสดงเฉพาะ item และจำนวนที่อยู่ใน fulfillment ของ shipment.created นั้น
// ไม่คง total/ราคาของ line ไว้ เพราะเป็นยอดของจำนวนทั้ง order ไม่ใช่จำนวนที่ส่งรอบนี้

type Quantity = number | string | { toString(): string } | null | undefined

type OrderItem = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
}

type FulfillmentItem = { line_item_id?: string | null; quantity?: Quantity }

export type ShippedItem = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  quantity: number
}

export const toShippedItems = (
  orderItems: (OrderItem | null)[] | null | undefined,
  fulfillmentItems: (FulfillmentItem | null)[] | null | undefined
): ShippedItem[] => {
  const shipped = new Map<string, ReturnType<typeof MathBN.convert>>()
  for (const item of fulfillmentItems ?? []) {
    if (!item?.line_item_id) {
      continue
    }
    const current = shipped.get(item.line_item_id) ?? MathBN.convert(0)
    shipped.set(item.line_item_id, MathBN.add(current, MathBN.convert(String(item.quantity ?? 0))))
  }

  return (orderItems ?? [])
    .filter((item): item is OrderItem => !!item && shipped.has(item.id))
    .map(({ id, title, product_title, variant_title }) => ({
      id,
      title,
      product_title,
      variant_title,
      quantity: shipped.get(id)!.toNumber(),
    }))
}
