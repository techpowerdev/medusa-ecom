// EV-27 (spec 02 กฎข้อ 43): เงื่อนไขก่อนสร้าง voucher pool — ตรวจจากข้อมูลของ Medusa (`GET /admin/products/:id`)
// ด่านจริงยังอยู่ที่ backend (`validateEvoucherVariantStep`, `resolveEvoucherPoolInventoryStep`) — ที่นี่แค่บอกแอดมินก่อนกรอกฟอร์ม

// fields ที่ widget ขอผ่าน `useProduct` (กฎ 43a) — path ของ inventory ตรงกับ query.graph ของ backend
export const EVOUCHER_POOL_PREREQUISITE_FIELDS = [
  "id",
  "*shipping_profile",
  "variants.id",
  "variants.manage_inventory",
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.required_quantity",
  "variants.inventory_items.inventory.variants.id",
  "variants.inventory_items.inventory.location_levels.location_id",
].join(",")

export type PrerequisiteVariant = {
  id: string
  manage_inventory?: boolean | null
  inventory_items?: {
    inventory_item_id: string
    required_quantity?: number | null
    inventory?: { variants?: { id: string }[] | null; location_levels?: { location_id: string }[] | null } | null
  }[] | null
}

export type PrerequisiteProduct = {
  id: string
  shipping_profile?: { id?: string | null } | null
  variants?: PrerequisiteVariant[] | null
}

export type PrerequisiteCode = "manageInventory" | "inventoryItem" | "shippingProfile" | "stockLocation"

export type PrerequisiteIssue = { code: PrerequisiteCode; to: string }

// คืน issue ที่ไม่ผ่านตามลำดับคงที่ของกฎ 43b; ทุกข้อผ่าน = []; ไม่พบ variant = null
export const evoucherPoolPrerequisites = (
  product: PrerequisiteProduct,
  variantId: string
): PrerequisiteIssue[] | null => {
  const variant = product.variants?.find((v) => v.id === variantId)
  if (!variant) {
    return null
  }
  const variantPath = `/products/${product.id}/variants/${variant.id}`
  const issues: PrerequisiteIssue[] = []
  if (variant.manage_inventory !== true) {
    issues.push({ code: "manageInventory", to: `${variantPath}/edit` })
  }
  const items = variant.inventory_items ?? []
  const [item] = items
  const shared = (item?.inventory?.variants ?? []).some((v) => v.id !== variant.id)
  const itemOk = items.length === 1 && Number(item!.required_quantity) === 1 && !shared
  if (!itemOk) {
    issues.push({ code: "inventoryItem", to: `${variantPath}/manage-items` })
  }
  if (product.shipping_profile?.id) {
    issues.push({ code: "shippingProfile", to: `/products/${product.id}/shipping-profile` })
  }
  // เงื่อนไขของ import (`import-evoucher-codes.ts`) — ตรวจเมื่อมี item เดียวที่ถูกต้องแล้วเท่านั้น
  if (itemOk && (item!.inventory?.location_levels ?? []).length !== 1) {
    issues.push({ code: "stockLocation", to: `/inventory/${item!.inventory_item_id}/locations` })
  }
  return issues
}
