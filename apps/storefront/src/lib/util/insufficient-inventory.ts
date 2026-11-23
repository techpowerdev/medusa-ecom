import { isUncodedMedusaError } from "./medusa-api-error"

// CORE-48 (spec 01 กฎข้อ 106): แก้จำนวนเกิน stock → Medusa 2.22.1 ตอบ 400 `not_allowed` code `insufficient_inventory`
// (`MedusaError.Codes.INSUFFICIENT_INVENTORY` ของ `core-flows/dist/cart/steps/confirm-inventory.js`)
// CORE-82 (กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ `MedusaApiError` (`medusaFetch`) — ไม่เทียบข้อความ
// ไม่อยู่ใน `CHECKOUT_CONFLICTS` — map นั้นคือ 409 ตอน complete ที่ contract test นับให้เท่ากับ backend

export const INSUFFICIENT_INVENTORY = "INSUFFICIENT_INVENTORY"

export const INSUFFICIENT_INVENTORY_MESSAGE =
  "สินค้ามีไม่พอตามจำนวนที่เลือก กรุณาลดจำนวนแล้วลองใหม่อีกครั้ง"

const CODE = "insufficient_inventory"

/** 400 ของ Medusa ที่ stock ไม่พอ (code `insufficient_inventory`); อื่นๆ (status อื่น, ไม่ใช่ object) → false */
export const isInsufficientInventory = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const { status, code } = error as { status?: unknown; code?: unknown }
  return status === 400 && code === CODE
}

/**
 * FS-22 (spec 03 กฎข้อ 27): 400 ของ Medusa ที่สต็อกไม่พอตอน complete cart — confirmInventory (มี code) หรือ
 * `reserveInventoryStep` ที่ไม่มี code (ข้อยกเว้นของ ADR-028 ใน `medusa-api-error.ts`); อื่นๆ → false
 */
export const isOutOfStockAtCompletion = (error: unknown): boolean =>
  isInsufficientInventory(error) || isUncodedMedusaError(error, "OUT_OF_STOCK_AT_RESERVE")
