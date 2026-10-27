import { isLineItemInScope, ProgramScope } from "./commission"

type ScopedProduct<V> = {
  collection_id?: string | null
  categories?: ({ id: string } | null)[] | null
  variants?: (V | null)[] | null
}

const nonEmpty = (ids?: string[]) => (ids?.length ? ids : null)

/**
 * กฎ 16 (AF-7): ขอบเขตโปรแกรม → filter ของ Product สำหรับ Query
 * union ของ variant_ids ∪ collection_ids ∪ category_ids (category ตรงตัว ไม่นับลูก — Q2); null = ไม่คลุมสินค้าใด
 */
export const productFiltersForScope = (scope: ProgramScope): Record<string, unknown> | null => {
  if (scope.all) {
    return { status: "published" }
  }
  const variantIds = nonEmpty(scope.variant_ids)
  const collectionIds = nonEmpty(scope.collection_ids)
  const categoryIds = nonEmpty(scope.category_ids)
  const $or = [
    ...(variantIds ? [{ variants: { id: variantIds } }] : []),
    ...(collectionIds ? [{ collection_id: collectionIds }] : []),
    ...(categoryIds ? [{ categories: { id: categoryIds } }] : []),
  ]
  return $or.length ? { status: "published", $or } : null
}

/** variant ที่อยู่ในขอบเขต — ใช้ isLineItemInScope ตัวเดียวกับการคำนวณค่าคอม (AF-3) */
export const variantsInScope = <V extends { id: string }>(scope: ProgramScope, product: ScopedProduct<V>): V[] => {
  const product_category_ids = (product.categories ?? []).flatMap((c) => (c ? [c.id] : []))
  return (product.variants ?? []).filter(
    (v): v is V =>
      !!v &&
      isLineItemInScope(scope, {
        id: v.id,
        variant_id: v.id,
        product_collection_id: product.collection_id,
        product_category_ids,
        subtotal: 0,
      })
  )
}

/** `{storefront}/r/{code}?to=/products/{handle}` (spec 05 API) — ไม่มี STOREFRONT_URL → ลิงก์ relative */
export const shareUrl = (storefrontUrl: string | undefined, code: string, handle: string) =>
  `${(storefrontUrl ?? "").replace(/\/+$/, "")}/r/${code}?to=/products/${handle}`
