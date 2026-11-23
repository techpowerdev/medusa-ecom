// PAY-17 (spec 06 กฎข้อ 19a): error ของ `stripe.confirmPayment` ขั้น review → ข้อความไทย (ADR-014) ตาม `type`/`code`
// ไม่ใช้ `message` ของ Stripe (ภาษาอังกฤษหรือตาม locale ของ Elements) — แบบเดียวกับข้อความไทยของ Elements ใน PAY-14 (กฎข้อ 16b)
export const STRIPE_CARD_DECLINED = "บัตรถูกปฏิเสธ กรุณาใช้บัตรใบอื่นหรือติดต่อธนาคารผู้ออกบัตร"
export const STRIPE_CARD_INVALID = "ข้อมูลบัตรไม่ถูกต้อง กรุณาตรวจสอบเลขบัตร วันหมดอายุ และรหัสความปลอดภัยหลังบัตร แล้วลองอีกครั้ง"
export const STRIPE_PAYMENT_FAILED = "ชำระเงินด้วยบัตรไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

// code ของ card_error ที่หมายถึงข้อมูลบัตรที่กรอกผิด (https://docs.stripe.com/error-codes)
const INVALID_CARD_CODES = new Set([
  "incorrect_number",
  "invalid_number",
  "invalid_expiry_month",
  "invalid_expiry_year",
  "expired_card",
  "incorrect_cvc",
  "invalid_cvc",
  "incorrect_zip",
])

// `message` ของ Stripe รับมาได้แต่ไม่ใช้ (กฎข้อ 19a)
type StripeErrorLike = { type?: string; code?: string; decline_code?: string; message?: string }

export const stripeErrorMessage = (error: StripeErrorLike): string => {
  if (error.type === "validation_error") return STRIPE_CARD_INVALID
  if (error.type !== "card_error") return STRIPE_PAYMENT_FAILED
  if (error.code === "card_declined" || (!error.code && error.decline_code)) return STRIPE_CARD_DECLINED
  return error.code && INVALID_CARD_CODES.has(error.code) ? STRIPE_CARD_INVALID : STRIPE_PAYMENT_FAILED
}
