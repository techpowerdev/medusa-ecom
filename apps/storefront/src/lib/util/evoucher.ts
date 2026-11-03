import { HttpTypes } from "@medusajs/types"

import { isVariantInStock } from "./inventory"

// EV-7b (spec 02 กฎข้อ 23): field ของ pool/partner ที่ backend อนุญาตผ่าน allowFields (EV-7a) — ขอทีละ path ไม่ขอ code
export const EVOUCHER_POOL_FIELDS = [
  "name",
  "face_value",
  "validity_note",
  "how_to_use",
  "partner.name",
  "partner.logo_url",
  "partner.terms_url",
]
  .map((path) => `+variants.evoucher_pool.${path}`)
  .join(",")

export type EvoucherPool = {
  name: string
  face_value: number | null
  validity_note: string | null
  how_to_use: string
  partner: { name: string; logo_url: string | null; terms_url: string | null }
}

export type VariantWithPool = Partial<HttpTypes.StoreProductVariant> & {
  evoucher_pool?: EvoucherPool | null
}

/**
 * pool ของ variant ที่เลือก (`?v_id=`) หรือ variant ตั้งต้นแบบเดียวกับ ProductActions (ตัวแรกที่มีของ ไม่งั้นตัวแรก)
 * variant ที่เลือกไม่มี pool → null (บล็อกพาร์ทเนอร์แสดงเฉพาะ variant ที่มี pool)
 */
export const evoucherPoolOf = (
  product: { variants?: VariantWithPool[] | null },
  variantId: string | null
): EvoucherPool | null => {
  const variants = product.variants ?? []
  const selected =
    variants.find((v) => v.id === variantId) ??
    variants.find((v) => isVariantInStock(v as HttpTypes.StoreProductVariant)) ??
    variants[0]
  return selected?.evoucher_pool ?? null
}

/**
 * EV-7e (spec 02 กฎข้อ 29c): pool ของ variant ที่ ProductActions เลือกอยู่จริง — ก่อน ProductActions เขียน `v_id` ลง URL
 * (`synced=false`) ใช้ variant ที่มันจะเลือก (`v_id` ที่มีจริง ไม่งั้นตัวตั้งต้น); หลังจากนั้นใช้ `v_id` ตรงตัว
 * ไม่มี `v_id` = ลูกค้าเลือก option ไม่ครบ/ไม่ถูกต้อง (ProductActions ลบออก) → null
 */
export const partnerBlockPool = (
  variants: VariantWithPool[] | null | undefined,
  variantId: string | null,
  synced: boolean
): EvoucherPool | null =>
  synced
    ? variants?.find((v) => v.id === variantId)?.evoucher_pool ?? null
    : evoucherPoolOf({ variants }, variantId)

/** EV-7e (spec 02 กฎข้อ 26): URL ของ partner ที่ render เป็นลิงก์/รูปได้ — เฉพาะ http(s) (กันข้อมูลที่บันทึกก่อน EV-14) */
export const safeHttpUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  try {
    const { protocol } = new URL(url)
    return protocol === "http:" || protocol === "https:" ? url : null
  } catch {
    return null
  }
}

/** EV-7e (spec 02 กฎข้อ 29a): หน้า /account/vouchers แบ่งหน้าละ 20 ตาม `?page=` */
export const VOUCHERS_PAGE_SIZE = 20

export const vouchersPagination = (page: string | string[] | undefined) => {
  const n =
    typeof page === "string" && /^[1-9]\d*$/.test(page) ? Number(page) : 1
  return { page: n, offset: (n - 1) * VOUCHERS_PAGE_SIZE }
}

export const vouchersHasNext = (
  { offset }: ReturnType<typeof vouchersPagination>,
  count: number
) => offset + VOUCHERS_PAGE_SIZE < count

/** variant แบบย่อสำหรับบล็อกพาร์ทเนอร์ — null เมื่อไม่มี variant ใดเป็น voucher */
export const voucherVariantsOf = (variants?: VariantWithPool[] | null) =>
  variants?.some((v) => v.evoucher_pool)
    ? variants.map((v) => ({
        id: v.id,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
        inventory_quantity: v.inventory_quantity,
        evoucher_pool: v.evoucher_pool ?? null,
      }))
    : null

/** รายการของ `GET /store/customers/me/evouchers` (EV-7a, กฎข้อ 22) */
export type CustomerEvoucher = {
  id: string
  code: string
  pin: string | null
  expires_at: string | null
  delivered_at: string | null
  order_id: string | null
  pool: Omit<EvoucherPool, "partner">
  partner: EvoucherPool["partner"] & { support_contact: string | null }
}
