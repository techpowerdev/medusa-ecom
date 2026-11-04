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

/**
 * ขั้นแรกที่ยังไม่เสร็จ: ไม่มีที่อยู่/อีเมล → address; delivery ยังไม่เสร็จ → delivery; ไม่งั้น payment
 * CORE-41 (spec 01 กฎข้อ 99): `checkout-form` ส่ง `options` = รายการที่กรองแล้ว (delivery ใช้ `deliveryStepDone(cart, options)`);
 * หน้าตะกร้าไม่ส่ง = พฤติกรรมเดิม
 */
export function checkoutStep(cart: CheckoutCart, options?: { id: string }[]) {
  if (!cart.shipping_address?.address_1 || !cart.email) {
    return "address"
  }
  return deliveryStepDone(cart, options) ? "payment" : "delivery"
}

/**
 * CORE-45 (spec 01 กฎข้อ 103): step ใน URL ที่ใช้ไม่ได้ → คืน step ปลายทาง (= `checkoutStep(cart, options)`) ไม่งั้น `null`
 * - ไม่มี step / ไม่ใช่ address|delivery|payment|review แบบตรงตัว → ขั้นแรกที่ยังไม่เสร็จ
 * - address → ไม่ redirect เสมอ; delivery → redirect เมื่อยังไม่มีที่อยู่ หรือ cart digital-only (ไม่มีขั้น delivery)
 * - payment/review → กฎข้อ 99 (ขั้นก่อนหน้ายังไม่เสร็จ)
 * ปลายทาง address/delivery(มีที่อยู่)/payment(พร้อมจ่าย) ไม่เข้าเงื่อนไขซ้ำ จึงไม่วน
 */
export function checkoutRedirectStep(
  step: string | undefined,
  cart: CheckoutCart,
  options?: { id: string }[]
): "address" | "delivery" | "payment" | null {
  const first = checkoutStep(cart, options)
  switch (step) {
    case "address":
      return null
    case "delivery":
      return first === "address" || isDigitalOnlyCart(cart) ? first : null
    case "payment":
    case "review":
      return first === "payment" ? null : first
    default:
      return first
  }
}

const COUNTRY_CODE_RE = /^[a-z]{2}$/

/**
 * รหัสประเทศจาก client (hidden input / URL) ที่ใช้ประกอบ path redirect ได้อย่างปลอดภัย — ไม่ผ่าน `^[a-z]{2}$` → undefined
 * กัน open redirect เช่น `/example.org` → `//example.org/...` (QA #174)
 */
export function safeCountryCode(value: unknown): string | undefined {
  return typeof value === "string" && COUNTRY_CODE_RE.test(value) ? value : undefined
}
