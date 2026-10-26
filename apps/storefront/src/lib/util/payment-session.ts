// PAY-2 (spec 06): logic ล้วนของขั้นตอนชำระเงิน (บัตร / PromptPay) — ไม่มี I/O

const CARD_PROVIDER = "pp_stripe_stripe"
const PROMPTPAY_PROVIDER = "pp_stripe-promptpay_stripe"

/** PromptPay QR หมดอายุหลัง 10 นาที (spec 06 Storefront) */
export const PROMPTPAY_TIMEOUT_MS = 10 * 60 * 1000

/** ช่วง poll สถานะ cart ระหว่างรอ webhook ของ PromptPay */
export const PROMPTPAY_POLL_MS = 3_000

export const isPromptPay = (providerId?: string) => providerId === PROMPTPAY_PROVIDER

/**
 * `data` ที่ส่งตอนสร้าง payment session — Stripe provider ของ Medusa อ่าน `data.payment_method_types`
 * (กฎข้อ 5): provider บัตรต้องเป็น card เท่านั้น; PromptPay provider กำหนด ["promptpay"] เอง
 */
export function paymentSessionData(providerId: string): Record<string, unknown> | undefined {
  if (providerId === CARD_PROVIDER) {
    return { payment_method_types: ["card"] }
  }
  return undefined
}

/** หมดอายุ 10 นาทีนับจากเวลาสร้าง PaymentIntent (`created` เป็นวินาที) — reload หน้าไม่ยืดเวลา */
export const promptPayDeadline = (intentCreatedSec: number) =>
  intentCreatedSec * 1000 + PROMPTPAY_TIMEOUT_MS

/**
 * เมื่อครบเวลา: ถ้า PaymentIntent ชำระแล้ว/กำลังดำเนินการ ห้ามลบ session (provider ไม่ cancel PI ที่ succeeded
 * → เงินถูกตัดแต่ไม่มี order) ให้ poll ต่อจน webhook complete cart; นอกนั้นยกเลิก session แล้วให้ลองใหม่
 */
export function promptPayExpiryAction(intentStatus: string | undefined): "keep-polling" | "reset" {
  return intentStatus === "succeeded" || intentStatus === "processing" ? "keep-polling" : "reset"
}

export const secondsLeft =(deadlineMs: number, nowMs: number) =>
  Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))

export const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

type PollableCart = {
  completed_at?: string | Date | null
  payment_collection?: { payment_sessions?: { status: string }[] | null } | null
} | null

type IntentWithNextAction = {
  status: string
  next_action?: {
    type?: string
    promptpay_display_qr_code?: { image_url_svg?: string; image_url_png?: string }
  } | null
}

/** URL รูป QR ของ PromptPay จาก PaymentIntent (stripe-js ยังไม่มี type ของ promptpay_display_qr_code) */
export function promptPayQrImage(intent: IntentWithNextAction | undefined): string | null {
  if (intent?.status !== "requires_action") return null
  const qr = intent.next_action?.promptpay_display_qr_code
  return qr?.image_url_svg ?? qr?.image_url_png ?? null
}

export type PromptPayPollState = "paid" | "failed" | "pending"

/** webhook เป็น source of truth (กฎข้อ 3): cart ถูก complete โดย webhook = ชำระแล้ว */
export function promptPayPollState(cart: PollableCart): PromptPayPollState {
  if (cart?.completed_at) return "paid"
  const sessions = cart?.payment_collection?.payment_sessions ?? []
  if (sessions.some((s) => s.status === "canceled" || s.status === "error")) return "failed"
  return "pending"
}

/** code ของ guard ฝั่ง backend (spec 06 กฎข้อ 7A): session เดิมชำระแล้ว ไม่ถูกลบ */
export const PAYMENT_ALREADY_COMPLETED = "PAYMENT_ALREADY_COMPLETED"

/**
 * ผลของการสร้าง session ใหม่ตอน QR หมดอายุที่ไม่สำเร็จ: 409 + code `PAYMENT_ALREADY_COMPLETED` = ชำระแล้ว → poll ต่อและ complete cart
 * เป็นทางสำรอง (AC-12, AC-12b); error อื่น → พฤติกรรมเดิม
 */
export function promptPayRenewalOutcome(status: number, body: unknown): "already-paid" | "error" {
  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined
  return status === 409 && code === PAYMENT_ALREADY_COMPLETED ? "already-paid" : "error"
}

/**
 * session PromptPay ที่ใช้ในขั้น review: `pending` (ยังไม่ชำระ) หรือ `authorized` (guard/webhook authorize แล้วแต่ cart ยังไม่ complete
 * — กดชำระอีกครั้งเพื่อ complete cart ตาม runbook ADR-015)
 */
export function promptPaySession<T extends { status: string; provider_id: string }>(
  sessions: T[] | null | undefined
): T | undefined {
  // review #98: เฉพาะ session ของ PromptPay — ไม่ไป complete cart ด้วย payment ของ provider อื่น
  const own = sessions?.filter((s) => isPromptPay(s.provider_id))
  return own?.find((s) => s.status === "pending") ?? own?.find((s) => s.status === "authorized")
}

/**
 * ทุกรอบ poll ระหว่างรอ order: cart complete แล้ว → complete (ได้ order เดิม); ยัง pending และอยู่ในโหมดทางสำรองหลัง 409
 * (`completeFallback`) → ลอง complete cart ซ้ำ (AC-12b: complete รอบก่อนล้ม/webhook ไม่มา); session ล้ม → fail
 */
export function promptPayPollAction(
  state: PromptPayPollState,
  completeFallback: boolean
): "complete" | "fail" | "wait" {
  if (state === "failed") return "fail"
  return state === "paid" || completeFallback ? "complete" : "wait"
}
