import { PlaceOrderOutcome, checkoutNotice } from "./place-order-outcome"

/** PAY-11 (spec 06 กฎข้อ 13): สิ่งที่ทางสำรอง PromptPay ทำต่อหลัง placeOrder */
export type PromptPayFinishAction = { kind: "refunded"; text: string } | { kind: "unauthorized" } | { kind: "retry" }

/**
 * ทางสำรองถูกเรียกหลังชำระแล้วเท่านั้น (paid = true): `refunded` (FLASH_* / สต็อกไม่พอ / code ใน allow-list ของ CORE-76) → หยุด poll
 * แสดงเหตุคืนเงิน; `unauthorized` → login ใหม่; `processing` (CART_COMPLETION_IN_PROGRESS) / `failed` (5xx, network) / ไม่มีผล → poll ต่อ (PAY-6b)
 */
export const promptPayFinishAction = (outcome: PlaceOrderOutcome | null | undefined): PromptPayFinishAction => {
  if (outcome?.kind === "unauthorized") return { kind: "unauthorized" }
  if (outcome?.kind === "refunded") {
    const notice = checkoutNotice(outcome, true)
    if (notice.kind === "refunded") return { kind: "refunded", text: notice.text }
  }
  return { kind: "retry" }
}
