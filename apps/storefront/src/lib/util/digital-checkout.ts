import { HttpTypes } from "@medusajs/types"

import { selectedShippingOptionId } from "./shipping-options"

// EV-7c (spec 02 กฎข้อ 24): cart ที่ทุก line requires_shipping=false (e-voucher) ข้ามขั้น delivery
// cart ผสมใช้ flow ปกติ (กฎข้อ 24d) — Medusa บังคับ shipping method ตาม line ที่ต้องจัดส่งเอง
type CheckoutCart = Pick<
  HttpTypes.StoreCart,
  "items" | "shipping_methods" | "shipping_address" | "email"
>

export function isDigitalOnlyCart(cart: Pick<CheckoutCart, "items"> | null | undefined) {
  const items = cart?.items ?? []
  return items.length > 0 && items.every((item) => item.requires_shipping === false)
}

/**
 * ขั้น delivery ถือว่าเสร็จ: digital-only ไม่ต้องมี shipping method (AC-3)
 * CORE-35 (spec 01 กฎข้อ 93): ส่ง `options` = รายการที่กรองแล้ว (กฎข้อ 89) → ต้องมี method ที่อยู่ในรายการนั้น
 * (method ค้างที่ถูกกรองออกไม่นับ); ไม่ส่ง = มี method ใดก็ได้ (หน้าตะกร้าที่ไม่มีรายการ option — ปลายทางตรวจซ้ำ)
 */
export function deliveryStepDone(
  cart: Pick<CheckoutCart, "items" | "shipping_methods">,
  options?: { id: string }[]
) {
  if (isDigitalOnlyCart(cart)) return true
  if (options) return selectedShippingOptionId(cart, options) !== null
  return (cart.shipping_methods?.length ?? 0) > 0
}

/** ขั้นแรกที่ยังไม่เสร็จ สำหรับปุ่มไปชำระเงินในหน้าตะกร้า */
export function checkoutStep(cart: CheckoutCart) {
  if (!cart.shipping_address?.address_1 || !cart.email) {
    return "address"
  }
  return deliveryStepDone(cart) ? "payment" : "delivery"
}

const COUNTRY_CODE_RE = /^[a-z]{2}$/

/**
 * รหัสประเทศจาก client (hidden input / URL) ที่ใช้ประกอบ path redirect ได้อย่างปลอดภัย — ไม่ผ่าน `^[a-z]{2}$` → undefined
 * กัน open redirect เช่น `/example.org` → `//example.org/...` (QA #174)
 */
export function safeCountryCode(value: unknown): string | undefined {
  return typeof value === "string" && COUNTRY_CODE_RE.test(value) ? value : undefined
}
