import { REFUNDED_NOTICE } from "./checkout-error"

// PAY-12 (spec 06 กฎข้อ 14): ค่า `?error=` ที่ `/api/payment-return` ส่งมาหน้า cart → ข้อความไทย (allow-list — ไม่ render ค่าจาก URL ตรง)
const CART_ERRORS: Record<string, string> = {
  refunded: REFUNDED_NOTICE,
  order_failed: "สร้างคำสั่งซื้อไม่สำเร็จ หากมีการตัดเงิน ระบบจะคืนเงินให้อัตโนมัติ กรุณาตรวจสอบตะกร้าแล้วสั่งใหม่",
  payment_failed: "ชำระเงินไม่สำเร็จ กรุณาเลือกวิธีชำระเงินอีกครั้ง",
}

/** ค่า `error` ของ search params → ข้อความไทย; ค่าอื่น (ไม่มี, ไม่รู้จัก, array) → null */
export const cartErrorNotice = (value: unknown): string | null =>
  typeof value === "string" && Object.hasOwn(CART_ERRORS, value) ? CART_ERRORS[value] : null
