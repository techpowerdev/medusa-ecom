// CORE-32 (spec 01 กฎข้อ 89): option วิธีส่งที่ลูกค้าเห็นได้ — checkout และหน้ากลุ่มใช้ helper นี้ตัวเดียว
// GET /store/shipping-options ของ Medusa 2.22.1 ไม่กรองตาม shipping profile ของสินค้า และ Store API ไม่อนุญาต
// field profile ของสินค้า (`items.product.shipping_profile.*` ไม่อยู่ใน allow-list ของ /store/carts, /store/products)
// → ทาง (b): cart ที่มี line ต้องจัดส่ง ซ่อน option ดิจิทัล (หาด้วย type.code — spec 02 กฎข้อ 8; name แก้ได้ใน admin)

/** type.code ของ option "Digital delivery" ใน seed (spec 02 กฎข้อ 8) */
export const DIGITAL_DELIVERY_TYPE_CODE = "digital-delivery"

type OptionLike = { type?: { code?: string | null } | null }
type CartLike = { items?: { requires_shipping?: boolean | null }[] | null }

/**
 * ตัด option ดิจิทัลออกเมื่อ cart มี line `requires_shipping = true`; cart ที่ทุก line ไม่ต้องจัดส่งคืนตามเดิม
 * (EV-7c ข้ามขั้น delivery เอง — กฎข้อ 89c) ผลว่าง = ผู้เรียกแสดงข้อความไม่มีวิธีส่งของหน้านั้น (กฎข้อ 89d)
 */
export function shippingOptionsForCart<T extends OptionLike>(options: T[], cart: CartLike): T[] {
  const needsShipping = (cart.items ?? []).some((item) => item.requires_shipping === true)
  if (!needsShipping) return options
  return options.filter((o) => o.type?.code !== DIGITAL_DELIVERY_TYPE_CODE)
}
