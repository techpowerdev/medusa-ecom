import { HttpTypes } from "@medusajs/types"

import { refundedWithoutSession } from "./payment-session"
import { selectedShippingOptionId } from "./shipping-options"

// EV-7c (spec 02 กฎข้อ 24): cart ที่ทุก line requires_shipping=false (e-voucher) ข้ามขั้น delivery
// cart ผสมใช้ flow ปกติ (กฎข้อ 24d) — Medusa บังคับ shipping method ตาม line ที่ต้องจัดส่งเอง
type CheckoutCart = Pick<
  HttpTypes.StoreCart,
  "items" | "shipping_methods" | "shipping_address" | "email"
>

// EV-7d (กฎข้อ 28b): ตัดสินจาก `requires_shipping` ของ line ที่ server คืนเท่านั้น — ไม่มี parameter flag จาก client
export function isDigitalOnlyCart(
  cart: { items?: { requires_shipping?: boolean | null }[] | null } | null | undefined
) {
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

/** CORE-69 (กฎข้อ 127): cart ที่ใช้ตัดสินขั้น review ต้องมี payment_collection/total ด้วย */
type ReviewCart = CheckoutCart &
  Partial<Pick<HttpTypes.StoreCart, "payment_collection" | "total">>

/**
 * CORE-69 (spec 01 กฎข้อ 127): ขั้น payment เสร็จ = มี payment session ที่ใช้ได้ (`pending` แบบ activeSession ของ Payment
 * หรือ `authorized` ที่ complete ได้เลย) หรือจ่ายด้วย gift card จนยอดเป็น 0 (เงื่อนไขเดียวกับ Review/Payment ของ starter)
 */
export function paymentStepDone(cart: ReviewCart) {
  const giftCards = (cart as { gift_cards?: unknown[] }).gift_cards
  if ((giftCards?.length ?? 0) > 0 && cart.total === 0) return true
  return (cart.payment_collection?.payment_sessions ?? []).some(
    (session) => session.status === "pending" || session.status === "authorized"
  )
}

/**
 * CORE-45 (spec 01 กฎข้อ 103): step ใน URL ที่ใช้ไม่ได้ → คืน step ปลายทาง (= `checkoutStep(cart, options)`) ไม่งั้น `null`
 * - ไม่มี step / ไม่ใช่ address|delivery|payment|review แบบตรงตัว → ขั้นแรกที่ยังไม่เสร็จ
 * - address → ไม่ redirect เสมอ; delivery → redirect เมื่อยังไม่มีที่อยู่ หรือ cart digital-only (ไม่มีขั้น delivery)
 * - payment/review → กฎข้อ 99 (ขั้นก่อนหน้ายังไม่เสร็จ); review ที่ยังไม่มี payment session ที่ใช้ได้ → payment (กฎข้อ 127)
 *   ยกเว้น collection คืนเงินครบและไม่มี session → คงขั้น review (PAY-19, spec 06 กฎข้อ 21)
 * ปลายทาง address/delivery(มีที่อยู่)/payment(พร้อมจ่าย) ไม่เข้าเงื่อนไขซ้ำ จึงไม่วน
 */
export function checkoutRedirectStep(
  step: string | undefined,
  cart: ReviewCart,
  options?: { id: string }[]
): "address" | "delivery" | "payment" | null {
  const first = checkoutStep(cart, options)
  switch (step) {
    case "address":
      return null
    case "delivery":
      return first === "address" || isDigitalOnlyCart(cart) ? first : null
    case "payment":
      return first === "payment" ? null : first
    case "review":
      // PAY-19 (spec 06 กฎข้อ 21 — มาก่อนกฎข้อ 127 เฉพาะกรณีนี้): คืนเงินครบ + ไม่มี session → คงขั้น review ให้เห็น notice คืนเงิน
      return first === "payment" && (paymentStepDone(cart) || refundedWithoutSession(cart)) ? null : first
    default:
      return first
  }
}

/**
 * D-1 (qa PR #288): cart ที่หน้าอ่านแบบ force-cache อาจยังเป็นค่าก่อน mutation (เช่น หน้า `step=delivery` หลัง `setAddresses`)
 * ถ้าเชื่อค่านั้น กฎข้อ 103b จะเด้งกลับ address → เมื่อ `checkoutRedirectStep` บอกให้ redirect ให้อ่าน cart ล่าสุด (`loadLatest`)
 * แล้วตัดสินซ้ำ (คืน cart/options ที่ใช้ตัดสินเพื่อ render ต่อ); ไม่ redirect = ไม่อ่าน cart เพิ่ม; อ่านไม่ได้ = ใช้ผลจาก cart เดิม
 */
export async function checkoutRedirectWithLatest<C extends ReviewCart>(
  step: string | undefined,
  cart: C,
  optionsFor: (cart: C) => { id: string }[],
  loadLatest: () => Promise<C | null>
) {
  const options = optionsFor(cart)
  const redirectStep = checkoutRedirectStep(step, cart, options)
  const latest = redirectStep ? await loadLatest() : null
  if (!latest) return { redirectStep, cart, options }
  const latestOptions = optionsFor(latest)
  return { redirectStep: checkoutRedirectStep(step, latest, latestOptions), cart: latest, options: latestOptions }
}

const COUNTRY_CODE_RE = /^[a-z]{2}$/

/**
 * รหัสประเทศจาก client (hidden input / URL) ที่ใช้ประกอบ path redirect ได้อย่างปลอดภัย — ไม่ผ่าน `^[a-z]{2}$` → undefined
 * กัน open redirect เช่น `/example.org` → `//example.org/...` (QA #174)
 */
export function safeCountryCode(value: unknown): string | undefined {
  return typeof value === "string" && COUNTRY_CODE_RE.test(value) ? value : undefined
}
