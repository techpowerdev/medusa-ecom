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

export const secondsLeft = (deadlineMs: number, nowMs: number) =>
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
