// CORE-82 (spec 01 กฎข้อ 140, ADR-028): error ที่ `medusaFetch` (`lib/data/medusa-fetch.ts`) throw เมื่อ Store API ตอบ non-2xx —
// เก็บ `code`/`type` ที่ `FetchError` ของ js-sdk 2.22.1 ทิ้ง; แยกไฟล์จาก medusa-fetch.ts (server-only) ให้ helper ที่ client import ใช้ได้
export class MedusaApiError extends Error {
  readonly status: number
  readonly type: string | null
  readonly code: string | null

  constructor({
    status,
    type = null,
    code = null,
    message,
  }: {
    status: number
    type?: string | null
    code?: string | null
    message: string
  }) {
    super(message)
    this.name = "MedusaApiError"
    this.status = status
    this.type = type
    this.code = code
  }
}

// ข้อยกเว้นของ ADR-028: error ของ Medusa core 2.22.1 ที่**ไม่มี** code → เทียบ status + type + ข้อความ (ไม่มีทางอื่น)
// ข้อความเปลี่ยนตอน bump → spec 07 checklist ข้อ 13; CORE-83/84 เพิ่มรายการของกลุ่มตัวเองที่นี่
const UNCODED_MEDUSA_ERRORS = {
  // `reserveInventoryStep` ของ completeCartWorkflow (`ensureInventoryAvailability` ของ @medusajs/inventory) — ต่อท้ายด้วย id จึงเทียบ prefix
  OUT_OF_STOCK_AT_RESERVE: { status: 400, type: "not_allowed", prefix: "Not enough stock available for item " },
  // `validateCartItemsStep` (core-flows/dist/cart/steps/validate-cart-items.js)
  EMPTY_CART_COMPLETION: { status: 400, type: "invalid_data", prefix: "Cannot complete a cart with no items" },
} as const

/** error ของ Medusa core ที่ไม่มี code ตามรายการข้อยกเว้น; อื่นๆ (ไม่ใช่ object, status/type ต่าง) → false */
export const isUncodedMedusaError = (error: unknown, name: keyof typeof UNCODED_MEDUSA_ERRORS): boolean => {
  const { status, type, message } = (typeof error === "object" && error !== null ? error : {}) as {
    status?: unknown
    type?: unknown
    message?: unknown
  }
  const expected = UNCODED_MEDUSA_ERRORS[name]
  return (
    status === expected.status &&
    type === expected.type &&
    typeof message === "string" &&
    message.startsWith(expected.prefix)
  )
}
