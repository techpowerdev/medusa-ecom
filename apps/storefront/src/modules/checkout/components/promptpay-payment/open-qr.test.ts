import type { Stripe } from "@stripe/stripe-js"
import { describe, expect, it, vi } from "vitest"

import { openQr } from "./open-qr"

// PAY-3b2: ขั้นเปิด QR พร้อมเพย์ที่ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order (spec 06 กฎข้อ 9c)
const NOW_SEC = Math.floor(Date.now() / 1000)
const QR = { type: "promptpay_display_qr_code", promptpay_display_qr_code: { image_url_svg: "https://qr/svg" } }
const intent = (status: string, created = NOW_SEC) => ({ status, created, next_action: status === "requires_action" ? QR : null })

const stripeWith = (confirmed: unknown) => {
  const confirmPromptPayPayment = vi.fn().mockResolvedValue(confirmed)
  return { stripe: { confirmPromptPayPayment } as unknown as Stripe, confirmPromptPayPayment }
}

describe("openQr", () => {
  it.each(["succeeded", "processing"])("PI %s → paid ไม่ confirm ซ้ำ", async (status) => {
    const { stripe, confirmPromptPayPayment } = stripeWith({})
    expect(await openQr(stripe, "cs", "a@b.c", intent(status) as never)).toEqual({ kind: "paid" })
    expect(confirmPromptPayPayment).not.toHaveBeenCalled()
  })

  it("เลย 10 นาทีนับจาก created → expired", async () => {
    const { stripe, confirmPromptPayPayment } = stripeWith({})
    expect(await openQr(stripe, "cs", "a@b.c", intent("requires_action", NOW_SEC - 601) as never)).toEqual({ kind: "expired" })
    expect(confirmPromptPayPayment).not.toHaveBeenCalled()
  })

  it("PI รอสแกนอยู่ (requires_action) → ใช้ QR เดิม ไม่ confirm ซ้ำ", async () => {
    const { stripe, confirmPromptPayPayment } = stripeWith({})
    const step = await openQr(stripe, "cs", "a@b.c", intent("requires_action") as never)
    expect(step).toEqual({ kind: "qr", image: "https://qr/svg", deadline: (NOW_SEC + 600) * 1000 })
    expect(confirmPromptPayPayment).not.toHaveBeenCalled()
  })

  it("PI ใหม่ → confirm ด้วยอีเมล (handleActions: false) แล้วคืน QR", async () => {
    const { stripe, confirmPromptPayPayment } = stripeWith({ paymentIntent: intent("requires_action") })
    const step = await openQr(stripe, "cs", "a@b.c", intent("requires_payment_method") as never)
    expect(step.kind).toBe("qr")
    expect(confirmPromptPayPayment).toHaveBeenCalledWith(
      "cs",
      { payment_method: { billing_details: { email: "a@b.c" } } },
      { handleActions: false }
    )
  })

  it("confirm ล้ม → error พร้อมข้อความของ Stripe", async () => {
    const { stripe } = stripeWith({ error: { message: "บัตรถูกปฏิเสธ" } })
    expect(await openQr(stripe, "cs", "a@b.c", undefined)).toEqual({ kind: "error", message: "บัตรถูกปฏิเสธ" })
  })

  it("confirm แล้วไม่มีรูป QR → error ภาษาไทย", async () => {
    const { stripe } = stripeWith({ paymentIntent: intent("processing") })
    const step = await openQr(stripe, "cs", "a@b.c", undefined)
    expect(step.kind).toBe("error")
    expect(step.kind === "error" && /[฀-๿]/.test(step.message)).toBe(true)
  })
})
