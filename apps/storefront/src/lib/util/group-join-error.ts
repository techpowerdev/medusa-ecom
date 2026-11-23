import type { ActionError } from "./action-result"
import { SIGN_IN_AGAIN_MESSAGE } from "./error-message"

// GB-7a2a (spec 04 กฎข้อ 29f, 30a): error ของ join/สร้างกลุ่ม → ข้อความไทยใน helper เดียว (หน้ากลุ่ม GB-7a2 + ปุ่มสร้างทีม GB-7c)
// CORE-84 (spec 01 กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ `MedusaApiError` (`medusaFetch`) เท่านั้น — ไม่เทียบข้อความของ backend
// contract test (`group-join-error.test.ts`) อ่าน code จาก source ของ backend และล้มเมื่อ code เปลี่ยนโดยไม่แก้ map นี้

const CODES = {
  GB_ALREADY_IN_OTHER_GROUP: "คุณอยู่ในกลุ่มอื่นของแคมเปญนี้แล้ว",
  GB_GROUP_FULL: "กลุ่มนี้เต็มแล้ว",
  GB_MAX_TOTAL_ORDERS_REACHED: "แคมเปญนี้ครบจำนวนออเดอร์แล้ว",
  GB_UNITS_LIMIT_EXCEEDED: "เกินจำนวนชิ้นสูงสุดต่อคน",
  GB_ITEMS_NOT_ELIGIBLE: "สินค้านี้ไม่ร่วมแคมเปญ",
  PROMOTION_NOT_COMBINABLE: "ใช้ร่วมกับโค้ดส่วนลดอื่นไม่ได้",
  GB_CART_ALREADY_JOINED: "รายการนี้เข้าร่วมกลุ่มแล้ว",
  GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED: "แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม",
  // GB-14 (กฎข้อ 35d): 400 NOT_ALLOWED
  GB_SHIPPING_PROFILE_NOT_COVERED: "วิธีจัดส่งที่เลือกใช้กับสินค้านี้ไม่ได้ กรุณาเลือกวิธีจัดส่งใหม่",
} as const

export type GroupJoinCode = keyof typeof CODES
export const GROUP_JOIN_CODES = Object.keys(CODES) as GroupJoinCode[]

// 400 INVALID_DATA ของ join ด้วย cart ว่าง (backend `GB_CART_EMPTY`) → `empty_cart`
const CART_EMPTY = "GB_CART_EMPTY"

const codeOf = (error: unknown) =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined

const CLOSED_MESSAGE = "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว"
const FAILED_MESSAGE = "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่"

/** code ที่รู้จักของ error (`MedusaApiError` หรือ `{ status, code }`); ไม่มี/ไม่รู้จัก → null */
export function groupJoinErrorCode(error: unknown): GroupJoinCode | null {
  const code = codeOf(error)
  return typeof code === "string" && Object.hasOwn(CODES, code) ? (code as GroupJoinCode) : null
}

const EMPTY_CART_MESSAGE = "กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นก่อนเข้าร่วม"

/** GB-7a2: ผลที่ล้มของ server action join (`ActionResult` ของ CORE-4i) — code ที่รู้จัก + closed (ปิดรับ) + empty_cart */
export type GroupJoinActionError = ActionError<GroupJoinCode | "closed" | "empty_cart">

/**
 * ฝั่ง server: error ของ join → `{ error }` ที่ส่งข้าม boundary ของ server action ได้: code ที่รู้จัก → code นั้น; 401 → unauthorized;
 * code `GB_CART_EMPTY` → empty_cart; 400/403 (mode ไม่เปิดให้สร้างทีม)/404 (กลุ่ม/แคมเปญไม่มีแล้ว) → closed; อื่นๆ → failed
 */
export function groupJoinFailure(error: unknown): { error: GroupJoinActionError } {
  const code = groupJoinErrorCode(error)
  if (code) return { error: code }
  const { status } = (error ?? {}) as { status?: unknown }
  if (status === 401) return { error: "unauthorized" }
  if (codeOf(error) === CART_EMPTY) return { error: "empty_cart" }
  if (status === 400 || status === 403 || status === 404) return { error: "closed" }
  return { error: "failed" }
}

/** ฝั่ง client: ข้อความไทยของผลที่ล้ม (แสดงใน `group-join-error`) */
export function groupJoinActionMessage(error: GroupJoinActionError, opts: { maxUnitsPerPerson?: number | null } = {}): string {
  if (error === "unauthorized") return SIGN_IN_AGAIN_MESSAGE
  if (error === "closed") return CLOSED_MESSAGE
  if (error === "empty_cart") return EMPTY_CART_MESSAGE
  if (error === "failed") return FAILED_MESSAGE
  if (error === "GB_UNITS_LIMIT_EXCEEDED" && opts.maxUnitsPerPerson) {
    return `${CODES[error]} (${opts.maxUnitsPerPerson} ชิ้น)`
  }
  return CODES[error]
}

/**
 * ข้อความไทยที่แสดงใน `group-join-error`: code ที่รู้จัก → ข้อความของ code; 401 → เข้าสู่ระบบใหม่;
 * cart ว่าง (`GB_CART_EMPTY`) → ให้เลือกสินค้า; 400/403/404 อื่น → ปิดรับแล้ว; อื่นๆ → ลองใหม่
 */
export function groupJoinErrorMessage(error: unknown, opts: { maxUnitsPerPerson?: number | null } = {}): string {
  return groupJoinActionMessage(groupJoinFailure(error).error, opts)
}
