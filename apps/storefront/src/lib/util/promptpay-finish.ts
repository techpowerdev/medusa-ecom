import { PlaceOrderOutcome, checkoutNotice } from "./place-order-outcome"

/**
 * สิ่งที่แสดงใน `promptpay-refunded`: ข้อความ + ทางไปต่อ — PAY-15 (กฎข้อ 17): `goToCart` = ลิงก์ "ไปที่ตะกร้า" แทนปุ่ม "เริ่มชำระใหม่"
 * (เหตุที่รู้ยังอยู่ในตะกร้าเดิม เริ่มชำระใหม่ = จ่ายซ้ำแล้วถูกคืนซ้ำ)
 */
export type PromptPayRefunded = { text: string; goToCart: boolean }

/** PAY-11 (spec 06 กฎข้อ 13): สิ่งที่ทางสำรอง PromptPay ทำต่อหลัง placeOrder */
export type PromptPayFinishAction = ({ kind: "refunded" } & PromptPayRefunded) | { kind: "unauthorized" } | { kind: "retry" }

/** PAY-6c: poll เห็นว่าเงินถูกคืนโดยไม่รู้เหตุ → ให้เริ่มชำระใหม่บนตะกร้าเดิม */
export const PROMPTPAY_REFUNDED_UNKNOWN: PromptPayRefunded = {
  text: "ชำระไม่สำเร็จ เงินจะคืนเข้าบัญชีของคุณตามรอบของธนาคาร กดเริ่มชำระใหม่เพื่อรับคิวอาร์โค้ดใหม่",
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
    if (notice.kind === "refunded") return { kind: "refunded", text: notice.text, goToCart: true }
  }
  return { kind: "retry" }
}

/**
 * PAY-17 (spec 06 กฎข้อ 19b): poll ที่เห็น `refunded` ระหว่าง `finish()` รอ placeOrder (`finishing`) ไม่ตัดสิน — ผลของ placeOrder ตัดสิน
 * (รู้เหตุ → ลิงก์ไปตะกร้าของ PAY-15; ล้มแบบอื่น → poll รอบถัดไปเห็น refunded แล้วตัดสินแบบ PAY-6c)
 */
export const promptPayPollWhileFinishing = <A extends string>(action: A, finishing: boolean): A | "wait" =>
  finishing && action === "refunded" ? "wait" : action
