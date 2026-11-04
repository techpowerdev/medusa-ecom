import { checkoutConflictCode, checkoutConflictMessage } from "./checkout-error"
import { SIGN_IN_AGAIN_MESSAGE } from "./error-message"
import { PAYMENT_ALREADY_COMPLETED, promptPayRenewalOutcome } from "./payment-session"

/**
 * CORE-4i (spec 01 กฎข้อ 72): ผลของ server action ที่ UI แสดง error — Next ใน production ซ่อนข้อความ/สถานะของ error
 * ที่ throw ข้าม boundary ของ server action จึงคืนผลแทนการ throw (`redirect`/`notFound` ของ Next ยัง throw ได้)
 * `C` = code ที่ผู้เรียกแยกทางเอง (เช่น `PROMOTION_NOT_COMBINABLE`)
 */
export type ActionError<C extends string = never> = "unauthorized" | "failed" | C
export type ActionResult<C extends string = never, T extends object = object> =
  | ({ ok: true } & T)
  | { error: ActionError<C> }

/**
 * แปลง error ของ SDK (`FetchError`) หรือผลของ fetch ตรง (`{ status, code }`) → `{ error }`:
 * 401/403 → `"unauthorized"`, code ที่รู้จักและอยู่ใน `codes` → code นั้น, อื่นๆ (5xx, network) → `"failed"`
 */
export function actionFailure<C extends string = never>(
  error: unknown,
  codes: readonly C[] = []
): { error: ActionError<C> } {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 401 || status === 403) {
    return { error: "unauthorized" }
  }
  const code = checkoutConflictCode(error) as C | null
  if (code && codes.includes(code)) {
    return { error: code }
  }
  console.error(error)
  return { error: "failed" }
}

/** CORE-4i-b (Q-C2 = (ก)): ผลของ action สร้าง payment session ทั้ง checkout และหน้า `/account/orders/:id/pay` */
export type PaymentSessionResult = ActionResult<typeof PAYMENT_ALREADY_COMPLETED>

/**
 * ผลของ `createPaymentSession` (`{ status, code }` — `status` 0 = network) → `PaymentSessionResult`:
 * 2xx → ok, 409 + `PAYMENT_ALREADY_COMPLETED` → code นั้น (spec 06 กฎข้อ 9 d), 401 → `"unauthorized"`,
 * non-2xx อื่นทุกแบบ (รวม 403) → `"failed"` (กฎข้อ 9 d2 ตัดสินจากสถานะของ GB-8 ไม่ดู status)
 */
export function paymentSessionResult(res: { status: number; code: string | null }): PaymentSessionResult {
  if (res.status >= 200 && res.status < 300) return { ok: true }
  if (promptPayRenewalOutcome(res.status, res) === "already-paid") return { error: PAYMENT_ALREADY_COMPLETED }
  if (res.status === 401) return { error: "unauthorized" }
  console.error("payment session failed", res)
  return { error: "failed" }
}

/**
 * ฝั่ง client: action ที่ reject เอง (request ไปยัง server action ล้ม/5xx — ไม่มีรายละเอียดใน production) → `{ error: "failed" }`
 * ให้ผู้เรียกอ่านผลรูปแบบเดียว
 */
export const settleAction = <T>(action: Promise<T>): Promise<T | { error: "failed" }> =>
  action.catch(() => ({ error: "failed" }) as const)

/** ข้อความไทยของผลที่ล้ม: unauthorized → `SIGN_IN_AGAIN_MESSAGE` (ตัวเดียวทั้งเว็บ), code ที่รู้จัก → ข้อความของ code, อื่นๆ → `fallback` */
export const actionErrorMessage = (error: string, fallback: string): string =>
  error === "unauthorized"
    ? SIGN_IN_AGAIN_MESSAGE
    : (checkoutConflictMessage({ code: error }) ?? fallback)
