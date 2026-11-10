// PAY-2: ตัดสินว่า e2e ของ Stripe รันได้แค่ไหนจาก env (logic ล้วน — test ใน stripe-env.unit.spec.ts)
// skip ได้เฉพาะเมื่อไม่มี key ทั้งคู่; key ผิดรูปแบบ fail เสมอ; CI ที่มี key ตัวเดียว fail

export type StripeE2eEnv = { ci: boolean; secret?: string; publishable?: string }
/** secret: test ที่ใช้แค่ Stripe API (AC-9) · ui: test ที่ต้องใช้ Stripe.js (AC-1..AC-5) */
export type StripeE2eMode = { secret: boolean; ui: boolean }

export function stripeE2eMode({ ci, secret = "", publishable = "" }: StripeE2eEnv): StripeE2eMode {
  const hasSecret = secret.trim() !== ""
  const hasPublishable = publishable.trim() !== ""

  if (hasSecret && !secret.startsWith("sk_test_")) {
    throw new Error("STRIPE_API_KEY ของ e2e ต้องเป็น Stripe test secret key (sk_test_)")
  }
  if (hasPublishable && !publishable.startsWith("pk_test_")) {
    throw new Error("NEXT_PUBLIC_STRIPE_KEY ของ e2e ต้องเป็น Stripe test publishable key (pk_test_)")
  }
  if (ci && hasSecret !== hasPublishable) {
    const missing = hasSecret ? "NEXT_PUBLIC_STRIPE_KEY" : "STRIPE_API_KEY"
    throw new Error(`CI มี Stripe key ไม่ครบ: ขาด ${missing} (ต้องตั้งทั้งคู่ของบัญชีเดียวกัน หรือไม่ตั้งเลย)`)
  }
  return { secret: hasSecret, ui: hasSecret && hasPublishable }
}
