import { PlaceOrderOutcome, checkoutNotice } from "./place-order-outcome"

/**
 * สิ่งที่แสดงใน `promptpay-refunded`: ข้อความ + ทางไปต่อ — PAY-15 (กฎข้อ 17): `goToCart` = ลิงก์ "ไปที่ตะกร้า" แทนปุ่ม "เริ่มชำระใหม่"
 * (เหตุที่รู้ยังอยู่ในตะกร้าเดิม เริ่มชำระใหม่ = จ่ายซ้ำแล้วถูกคืนซ้ำ)
 */
export type PromptPayRefunded = { text: string; goToCart: boolean }

/** PAY-11 (spec 06 กฎข้อ 13): สิ่งที่ทางสำรอง PromptPay ทำต่อหลัง placeOrder */
export type PromptPayFinishAction = ({ kind: "refunded" } & PromptPayRefunded) | { kind: "unauthorized" } | { kind: "retry" }

/**
 * PAY-19 (spec 06 กฎข้อ 21f — owner Q-P16 2026-11-24): refund ของพร้อมเพย์ผ่าน Stripe ต้องให้ลูกค้ากรอกบัญชีรับเงินคืนจากอีเมล
 * (refund สถานะ `requires_action`) — ข้อความพร้อมเพย์จึงบอกให้ตรวจอีเมล ไม่ใช่ "เข้าบัญชีตามรอบของธนาคาร" แบบบัตร
 */
const PROMPTPAY_REFUND_EMAIL =
  "เราเริ่มคืนเงินเต็มจำนวนแล้ว ผู้ให้บริการชำระเงินจะส่งอีเมลถึงอีเมลที่ใช้สั่งซื้อเพื่อให้คุณกรอกบัญชีรับเงินคืน กรุณาตรวจอีเมล"

/** เหตุสินค้า/สิทธิ์ราคาพิเศษหมดหรือสต็อกไม่พอ (คู่กับ REFUNDED_NOTICE ของบัตร) */
export const PROMPTPAY_REFUNDED_NOTICE = `สินค้า/สิทธิ์ราคาพิเศษหมดระหว่างชำระเงิน ${PROMPTPAY_REFUND_EMAIL} แล้วปรับตะกร้าก่อนสั่งใหม่`

/** เหตุโปรโมชันใช้ร่วมกันไม่ได้ (คู่กับ PROMOTION_REFUNDED_NOTICE ของบัตร) */
export const PROMPTPAY_PROMOTION_REFUNDED_NOTICE = `โปรโมชันที่ใช้ไม่สามารถใช้ร่วมกันได้ ${PROMPTPAY_REFUND_EMAIL} แล้วปรับโค้ดส่วนลดก่อนสั่งใหม่`

/** PAY-6c: poll เห็นว่าเงินถูกคืนโดยไม่รู้เหตุ → ให้เริ่มชำระใหม่บนตะกร้าเดิม */
export const PROMPTPAY_REFUNDED_UNKNOWN: PromptPayRefunded = {
  text: `ชำระไม่สำเร็จ ${PROMPTPAY_REFUND_EMAIL} กดเริ่มชำระใหม่เพื่อรับคิวอาร์โค้ดใหม่`,
  goToCart: false,
}

/**
 * ทางสำรองถูกเรียกหลังชำระแล้วเท่านั้น (paid = true): `refunded` (FLASH_* / สต็อกไม่พอ / code ใน allow-list ของ CORE-76) → หยุด poll
 * แสดงเหตุคืนเงินพร้อมลิงก์ไปตะกร้า (PAY-15); `unauthorized` → login ใหม่; `processing` (CART_COMPLETION_IN_PROGRESS) / `failed` (5xx, network) / ไม่มีผล → poll ต่อ (PAY-6b)
 */
export const promptPayFinishAction = (outcome: PlaceOrderOutcome | null | undefined): PromptPayFinishAction => {
  if (outcome?.kind === "unauthorized") return { kind: "unauthorized" }
  if (outcome?.kind === "refunded") {
    const notice = checkoutNotice(outcome, true)
    if (notice.kind === "refunded") {
      const text = outcome.code === "PROMOTION_NOT_COMBINABLE" ? PROMPTPAY_PROMOTION_REFUNDED_NOTICE : PROMPTPAY_REFUNDED_NOTICE
      return { kind: "refunded", text, goToCart: true }
    }
  }
  return { kind: "retry" }
}

/**
 * PAY-17 (spec 06 กฎข้อ 19b): poll ที่เห็น `refunded` ระหว่าง `finish()` รอ placeOrder (`finishing`) ไม่ตัดสิน — ผลของ placeOrder ตัดสิน
 * (รู้เหตุ → ลิงก์ไปตะกร้าของ PAY-15; ล้มแบบอื่น → poll รอบถัดไปเห็น refunded แล้วตัดสินแบบ PAY-6c)
 */
export const promptPayPollWhileFinishing = <A extends string>(action: A, finishing: boolean): A | "wait" =>
  finishing && action === "refunded" ? "wait" : action
