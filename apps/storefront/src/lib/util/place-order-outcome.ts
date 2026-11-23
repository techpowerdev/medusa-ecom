import { OUT_OF_STOCK, REFUNDED_NOTICE, checkoutConflictCode, checkoutConflictMessage } from "./checkout-error"
import { INSUFFICIENT_INVENTORY_MESSAGE, isOutOfStockAtCompletion } from "./insufficient-inventory"

// CORE-76 (spec 01 กฎข้อ 134 a2 — session หลักตัดสิน 2026-11-21 ตามรายงาน builder CORE-76): backend ตอบ 409 code นี้แทนข้อความกลาง
// ของ Medusa เมื่อ workflow complete ของ cart เดียวกันยังรันอยู่ (`apps/backend/src/api/store/carts/errors.ts`)
// CORE-82 (กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ `MedusaApiError` (`medusaFetch`) — ไม่เทียบข้อความ
export const CART_COMPLETION_IN_PROGRESS = "CART_COMPLETION_IN_PROGRESS"

/**
 * ผลที่ไม่ได้ order ของ `placeOrder` (ได้ order = redirect ของ Next):
 * `refunded` = workflow ล้มด้วยเหตุที่รู้แน่ (FLASH_*, PROMOTION_NOT_COMBINABLE, สต็อกไม่พอ) — ถ้าตัดเงินแล้ว Medusa คืนเงินเอง
 * (`compensatePaymentIfNeededStep` อยู่ก่อน hook validate และ reserveInventory); `processing` = อีก request กำลัง complete cart นี้
 */
export type PlaceOrderOutcome =
  | { kind: "refunded"; code: string }
  | { kind: "processing" }
  | { kind: "unauthorized" }
  | { kind: "failed" }

/** allow-list: error ของ `POST /store/carts/:id/complete` → kind; error อื่น (4xx อื่น, 5xx, network) → `failed` */
export const placeOrderOutcome = (error: unknown): PlaceOrderOutcome => {
  const { status, code } = (typeof error === "object" && error !== null ? error : {}) as {
    status?: unknown
    code?: unknown
  }
  if (status === 401 || status === 403) return { kind: "unauthorized" }
  if (isOutOfStockAtCompletion(error)) return { kind: "refunded", code: OUT_OF_STOCK }
  const conflict = checkoutConflictCode(error)
  if (conflict) return { kind: "refunded", code: conflict }
  if (status === 409 && code === CART_COMPLETION_IN_PROGRESS) return { kind: "processing" }
  return { kind: "failed" }
}

export const PROCESSING_NOTICE = "กำลังดำเนินการคำสั่งซื้อ กรุณารอสักครู่"

// session หลักตัดสิน 2026-11-21: PROMOTION_NOT_COMBINABLE หลังตัดเงินคืนเงินเช่นกัน แต่เหตุไม่ใช่ "สินค้า/สิทธิ์ราคาพิเศษหมด"
export const PROMOTION_REFUNDED_NOTICE =
  "โปรโมชันที่ใช้ไม่สามารถใช้ร่วมกันได้ ระบบคืนเงินเต็มจำนวนให้อัตโนมัติแล้ว (เข้าบัญชีตามรอบของธนาคาร) กรุณาปรับโค้ดส่วนลดแล้วสั่งใหม่"

const FAILED_TEXT = "ยืนยันคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/** สิ่งที่ขั้น review แสดง — notice คืนเงินเป็น state ของตัวเอง ไม่ใช่ข้อความ error */
export type CheckoutNotice = { kind: "refunded"; text: string } | { kind: "processing" } | { kind: "error"; text: string }

/**
 * kind → สิ่งที่แสดง (`unauthorized` ผู้เรียกพาไปหน้า login เอง): `paid` = ตัดเงินแล้วก่อน complete (บัตรหลัง PaymentIntent
 * succeeded/requires_capture) → refunded แสดงว่าคืนเงินแล้ว; ไม่ได้ตัดเงิน (manual) → ข้อความเดิมของ code / สต็อกไม่พอให้ลดจำนวน
 */
export const checkoutNotice = (
  outcome: Exclude<PlaceOrderOutcome, { kind: "unauthorized" }>,
  paid: boolean
): CheckoutNotice => {
  if (outcome.kind === "processing") return { kind: "processing" } // object ใหม่ทุกครั้ง → รอบ poll ถัดไปของผู้เรียก (useEffect)
  if (outcome.kind === "failed") return { kind: "error", text: FAILED_TEXT }
  if (paid) {
    return {
      kind: "refunded",
      text: outcome.code === "PROMOTION_NOT_COMBINABLE" ? PROMOTION_REFUNDED_NOTICE : REFUNDED_NOTICE,
    }
  }
  if (outcome.code === OUT_OF_STOCK) return { kind: "error", text: INSUFFICIENT_INVENTORY_MESSAGE }
  return { kind: "error", text: checkoutConflictMessage({ code: outcome.code }) ?? FAILED_TEXT }
}
