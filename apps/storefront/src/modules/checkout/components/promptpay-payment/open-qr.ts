import { promptPayDeadline, promptPayExpiryAction, promptPayQrImage } from "@lib/util/payment-session"
import type { PaymentIntent, Stripe } from "@stripe/stripe-js"

export type PromptPayQrStep =
  | { kind: "paid" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "qr"; image: string; deadline: number }

/**
 * PAY-2/PAY-3b2: ขั้นเปิด QR พร้อมเพย์ที่ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order (spec 06 กฎข้อ 9c)
 * `current` = PI ที่ผู้เรียกอ่านมาก่อน — checkout ต้องอ่านภายใน `syncAffiliateBefore` (spec 05 กฎ 31b; static test AF-3c ตรวจที่จุดเรียก)
 * โหลดหน้าใหม่ระหว่างรอ: PI ยังรอสแกน → ใช้ QR เดิม ไม่ confirm ซ้ำ; ชำระแล้ว/กำลังดำเนินการ → paid; เลย 10 นาทีนับจาก `created` → expired
 */
export async function openQr(
  stripe: Stripe,
  clientSecret: string,
  email: string,
  current: PaymentIntent | undefined
): Promise<PromptPayQrStep> {
  let intent = current
  if (intent && promptPayExpiryAction(intent.status) === "keep-polling") return { kind: "paid" }
  if (intent && Date.now() >= promptPayDeadline(intent.created)) return { kind: "expired" }
  if (intent?.status !== "requires_action") {
    const confirmed = await stripe.confirmPromptPayPayment(
      clientSecret,
      { payment_method: { billing_details: { email } } },
      { handleActions: false }
    )
    if (confirmed.error) {
      return { kind: "error", message: confirmed.error.message ?? "ชำระด้วยพร้อมเพย์ไม่สำเร็จ" }
    }
    intent = confirmed.paymentIntent
  }
  const image = promptPayQrImage(intent)
  if (!intent || !image) {
    return { kind: "error", message: "สร้างคิวอาร์โค้ดพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }
  return { kind: "qr", image, deadline: promptPayDeadline(intent.created) }
}
