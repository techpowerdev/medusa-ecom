import { HttpTypes } from "@medusajs/types"

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

/** ขั้น delivery ถือว่าเสร็จ: digital-only ไม่ต้องมี shipping method (AC-3) */
export function deliveryStepDone(cart: Pick<CheckoutCart, "items" | "shipping_methods">) {
  return isDigitalOnlyCart(cart) || (cart.shipping_methods?.length ?? 0) > 0
}

/** ขั้นแรกที่ยังไม่เสร็จ สำหรับปุ่มไปชำระเงินในหน้าตะกร้า */
export function checkoutStep(cart: CheckoutCart) {
  if (!cart.shipping_address?.address_1 || !cart.email) {
    return "address"
  }
  return deliveryStepDone(cart) ? "payment" : "delivery"
}
