import { normalize } from "./checkout-error"

// CORE-48 (spec 01 กฎข้อ 106): แก้จำนวนเกิน stock → Medusa 2.22.1 ตอบ 400 `not_allowed` code `insufficient_inventory`
// ข้อความ "Some variant does not have the required inventory" (`core-flows/dist/cart/steps/confirm-inventory.js`)
// `FetchError` ของ js-sdk เก็บแค่ message/status ไม่มี `code` จึงจับคู่ทั้ง code และข้อความคงที่ (แบบ `checkout-error.ts`)
// ไม่อยู่ใน `CHECKOUT_CONFLICTS` — map นั้นคือ 409 ตอน complete ที่ contract test นับให้เท่ากับ backend

export const INSUFFICIENT_INVENTORY = "INSUFFICIENT_INVENTORY"

export const INSUFFICIENT_INVENTORY_MESSAGE =
  "สินค้ามีไม่พอตามจำนวนที่เลือก กรุณาลดจำนวนแล้วลองใหม่อีกครั้ง"

const CODE = "insufficient_inventory"
const MESSAGE = "Some variant does not have the required inventory"

/** 400 ของ Medusa ที่ stock ไม่พอ (จาก `code` หรือข้อความคงที่); อื่นๆ (status อื่น, ไม่ใช่ object) → false */
export const isInsufficientInventory = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown }
  return (
    status === 400 &&
    (code === CODE || (typeof message === "string" && normalize(message) === normalize(MESSAGE)))
  )
}
