import type { ActionError } from "./action-result"
import { SIGN_IN_AGAIN_MESSAGE } from "./error-message"

// GB-7a2a (spec 04 กฎข้อ 29f, 30a): error ของ join/สร้างกลุ่ม → ข้อความไทยใน helper เดียว (หน้ากลุ่ม GB-7a2 + ปุ่มสร้างทีม GB-7c)
// `FetchError` ของ js-sdk 2.22.1 เก็บแค่ message/status ไม่มี `code` (แบบ checkout-error.ts) → ใช้ `code` ถ้ามี ไม่งั้นจับจาก
// ข้อความคงที่ของ backend (`modules/group_buy/utils/join.ts` — contract test ล้มเมื่อข้อความเปลี่ยน) หรือชื่อ code ในข้อความ (กฎข้อ 30a)

const CODES = {
  GB_ALREADY_IN_OTHER_GROUP: { text: "คุณอยู่ในกลุ่มอื่นของแคมเปญนี้แล้ว", message: /^you are already in another group of this campaign$/ },
  GB_GROUP_FULL: { text: "กลุ่มนี้เต็มแล้ว", message: /^the group is full$/ },
  GB_MAX_TOTAL_ORDERS_REACHED: { text: "แคมเปญนี้ครบจำนวนออเดอร์แล้ว", message: /^the campaign has reached its order limit$/ },
  GB_UNITS_LIMIT_EXCEEDED: { text: "เกินจำนวนชิ้นสูงสุดต่อคน", message: /^at most \d+ units per person$/ },
  GB_ITEMS_NOT_ELIGIBLE: { text: "สินค้านี้ไม่ร่วมแคมเปญ", message: /^the cart has items outside the campaign$/ },
  PROMOTION_NOT_COMBINABLE: {
    text: "ใช้ร่วมกับโค้ดส่วนลดอื่นไม่ได้",
    message: /^a group buy can't be combined with other promotion codes on the cart$/,
  },
  GB_CART_ALREADY_JOINED: { text: "รายการนี้เข้าร่วมกลุ่มแล้ว", message: /^this cart was already used to join a group$/ },
  GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED: { text: "แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม", message: null },
  // GB-14 (กฎข้อ 35d): 400 ที่มีชื่อ code ในข้อความ
  GB_SHIPPING_PROFILE_NOT_COVERED: { text: "วิธีจัดส่งที่เลือกใช้กับสินค้านี้ไม่ได้ กรุณาเลือกวิธีจัดส่งใหม่", message: null },
} as const

export type GroupJoinCode = keyof typeof CODES
export const GROUP_JOIN_CODES = Object.keys(CODES) as GroupJoinCode[]

const CLOSED_MESSAGE = "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว"
const FAILED_MESSAGE = "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่"

// medusaError ทำตัวแรกเป็นตัวใหญ่และต่อ "." ท้ายข้อความ — ตัดออกก่อนเทียบ
const normalize = (message: string) => message.trim().replace(/\.$/, "").toLowerCase()

/** code ที่รู้จักของ error (FetchError หรือ `{ status, code, message }`); ไม่รู้จัก → null */
export function groupJoinErrorCode(error: unknown): GroupJoinCode | null {
  if (typeof error !== "object" || error === null) return null
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code === "string" && code in CODES) return code as GroupJoinCode
  if (typeof message !== "string") return null
  const text = normalize(message)
  return GROUP_JOIN_CODES.find((c) => CODES[c].message?.test(text) || message.includes(c)) ?? null
}

const EMPTY_CART_MESSAGE = "กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นก่อนเข้าร่วม"

/** GB-7a2: ผลที่ล้มของ server action join (`ActionResult` ของ CORE-4i) — code ที่รู้จัก + closed (ปิดรับ) + empty_cart */
export type GroupJoinActionError = ActionError<GroupJoinCode | "closed" | "empty_cart">

/**
 * ฝั่ง server: error ของ join → `{ error }` ที่ส่งข้าม boundary ของ server action ได้: code ที่รู้จัก → code นั้น; 401 → unauthorized;
 * 400 "The cart has no items" → empty_cart; 400/403 (mode ไม่เปิดให้สร้างทีม)/404 (กลุ่ม/แคมเปญไม่มีแล้ว) → closed; อื่นๆ → failed
 */
export function groupJoinFailure(error: unknown): { error: GroupJoinActionError } {
  const code = groupJoinErrorCode(error)
  if (code) return { error: code }
  const { status, message } = (error ?? {}) as { status?: unknown; message?: unknown }
  if (status === 401) return { error: "unauthorized" }
  if (status === 400 && typeof message === "string" && normalize(message) === "the cart has no items") {
    return { error: "empty_cart" }
  }
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
    return `${CODES[error].text} (${opts.maxUnitsPerPerson} ชิ้น)`
  }
  return CODES[error].text
}

/**
 * ข้อความไทยที่แสดงใน `group-join-error`: code ที่รู้จัก → ข้อความของ code; 401 → เข้าสู่ระบบใหม่;
 * 400 cart ว่าง → ให้เลือกสินค้า; 400/403/404 อื่น → ปิดรับแล้ว; อื่นๆ → ลองใหม่
 */
export function groupJoinErrorMessage(error: unknown, opts: { maxUnitsPerPerson?: number | null } = {}): string {
  return groupJoinActionMessage(groupJoinFailure(error).error, opts)
}
