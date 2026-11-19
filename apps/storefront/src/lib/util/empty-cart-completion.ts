import { normalize } from "./checkout-error"

// CORE-52 (spec 01 กฎข้อ 110a): Medusa 2.22.1 `validateCartItemsStep` (core-flows/dist/cart/steps/validate-cart-items.js)
// ตอบ 400 ข้อความคงที่นี้เมื่อ complete cart ที่ไม่มี item — `FetchError` ของ js-sdk ไม่มี code จึงจับคู่ข้อความ
// (แบบ `checkout-error.ts` / `insufficient-inventory.ts`)
const MESSAGE = "Cannot complete a cart with no items"

/** 400 ของ Medusa ที่ cart ไม่มี item ตอน complete; อื่นๆ → false */
export const isEmptyCartCompletion = (error: unknown): boolean => {
  const { status, message } = (error ?? {}) as { status?: unknown; message?: unknown }
  return status === 400 && typeof message === "string" && normalize(message) === normalize(MESSAGE)
}
