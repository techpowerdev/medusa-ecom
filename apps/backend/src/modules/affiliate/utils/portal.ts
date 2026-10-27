import { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"
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

export type PortalTab = "active" | "upcoming"
type RankedProgram = { id: string; commission_value: BigNumberInput; starts_at: Date | string }
export type ProgramCoverage<P extends RankedProgram> = { program: P; variant_ids: string[] }
export type ProductCard<P extends RankedProgram> = { program: P; variant_ids: string[]; rate_varies: boolean }

const rate = (p: RankedProgram) => MathBN.convert(p.commission_value)
const startsAt = (p: RankedProgram) => new Date(p.starts_at).getTime()
const byRate = (a: RankedProgram, b: RankedProgram) => rate(b).comparedTo(rate(a))
const byId = (a: RankedProgram, b: RankedProgram) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const PREFERENCE: Record<PortalTab, (a: RankedProgram, b: RankedProgram) => number> = {
  // กฎ 29a = Q7: อัตราสูงสุดก่อน เสมอกันเลือก starts_at ล่าสุด
  active: (a, b) => byRate(a, b) || startsAt(b) - startsAt(a) || byId(a, b),
  // กฎ 29b: starts_at เร็วสุดก่อน เสมอกันเลือกอัตราสูงสุด
  upcoming: (a, b) => startsAt(a) - startsAt(b) || byRate(a, b) || byId(a, b),
}

/**
 * กฎ 29 (AF-7b): เลือกโปรแกรมของการ์ดสินค้าจากโปรแกรมที่คลุม variant ของสินค้า (coverage ว่าง = ไม่คลุม)
 * active → variant ทุกตัวที่โปรแกรม active ใดคลุม และ rate_varies เมื่ออัตราที่ได้จริงต่อ variant ไม่เท่ากัน
 * upcoming → variant ของโปรแกรมที่เลือกเท่านั้น (rate_varies = false เพราะการ์ดแสดงโปรแกรมเดียว)
 */
export const selectProductProgram = <P extends RankedProgram>(
  tab: PortalTab,
  coverages: ProgramCoverage<P>[]
): ProductCard<P> | null => {
  const ranked = coverages
    .filter((c) => c.variant_ids.length)
    .sort((a, b) => PREFERENCE[tab](a.program, b.program))
  if (!ranked.length) {
    return null
  }
  const [best] = ranked
  if (tab === "upcoming") {
    return { program: best.program, variant_ids: best.variant_ids, rate_varies: false }
  }
  // variant ได้อัตราของโปรแกรมแรกตามลำดับ PREFERENCE ที่คลุมมัน (เหมือนการคิดเงินต่อ line ของ AF-3)
  const variantRate = new Map<string, P>()
  for (const { program, variant_ids } of ranked) {
    for (const id of variant_ids) {
      if (!variantRate.has(id)) {
        variantRate.set(id, program)
      }
    }
  }
  const rate_varies = [...variantRate.values()].some((p) => !rate(p).isEqualTo(rate(best.program)))
  return { program: best.program, variant_ids: [...variantRate.keys()], rate_varies }
}
