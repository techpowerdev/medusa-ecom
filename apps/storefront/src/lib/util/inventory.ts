import { HttpTypes } from "@medusajs/types"

export const isVariantInStock = (
  variant: HttpTypes.StoreProductVariant | undefined
) =>
  !!variant &&
  (!variant.manage_inventory ||
    !!variant.allow_backorder ||
    (variant.inventory_quantity ?? 0) > 0)

// CORE-14b (กฎ 26): variant ที่ค้างไว้ข้าม login ต้องมีอยู่, มีราคาใน region และ stock พอกับจำนวนที่เลือก
export const canPurchaseVariant = (
  variant: HttpTypes.StoreProductVariant | null | undefined,
  quantity: number
) =>
  !!variant &&
  variant.calculated_price?.calculated_amount != null &&
  (!variant.manage_inventory ||
    !!variant.allow_backorder ||
    (variant.inventory_quantity ?? 0) >= quantity)
