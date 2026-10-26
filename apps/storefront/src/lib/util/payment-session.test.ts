import { describe, expect, it } from "vitest"

import {
  PROMPTPAY_TIMEOUT_MS,
  formatCountdown,
  isPromptPay,
  paymentSessionData,
  promptPayDeadline,
  promptPayExpiryAction,
  promptPayPollState,
  promptPayQrImage,
  promptPayRenewalOutcome,
  promptPaySession,
  secondsLeft,
} from "./payment-session"

// PAY-2 (spec 06 กฎข้อ 5, AC-9): session ของ provider บัตรต้องขอ PaymentIntent แบบ card เท่านั้น
describe("paymentSessionData", () => {
  it("provider บัตร pp_stripe_stripe ส่ง payment_method_types = ['card']", () => {
    expect(paymentSessionData("pp_stripe_stripe")).toEqual({
      payment_method_types: ["card"],
    })
  })

  it("PromptPay และ provider อื่นไม่ส่ง data (provider กำหนดเอง)", () => {
    expect(paymentSessionData("pp_stripe-promptpay_stripe")).toBeUndefined()
    expect(paymentSessionData("pp_system_default")).toBeUndefined()
  })
})

describe("isPromptPay", () => {
  it("รู้จักเฉพาะ provider PromptPay ของ Stripe", () => {
    expect(isPromptPay("pp_stripe-promptpay_stripe")).toBe(true)
    expect(isPromptPay("pp_stripe_stripe")).toBe(false)
    expect(isPromptPay(undefined)).toBe(false)
  })
})

describe("PromptPay countdown (หมดอายุหลัง 10 นาที)", () => {
  it("timeout คือ 10 นาที", () => {
    expect(PROMPTPAY_TIMEOUT_MS).toBe(10 * 60 * 1000)
  })

  it("secondsLeft นับถอยหลังจาก deadline และไม่ติดลบ", () => {
    const deadline = 1_000_000
    expect(secondsLeft(deadline, deadline - 600_000)).toBe(600)
    expect(secondsLeft(deadline, deadline - 1_500)).toBe(2)
    expect(secondsLeft(deadline, deadline)).toBe(0)
    expect(secondsLeft(deadline, deadline + 5_000)).toBe(0)
  })

  it("formatCountdown แสดง m:ss", () => {
    expect(formatCountdown(600)).toBe("10:00")
    expect(formatCountdown(599)).toBe("9:59")
    expect(formatCountdown(5)).toBe("0:05")
    expect(formatCountdown(0)).toBe("0:00")
  })
})

// webhook เป็น source of truth (กฎข้อ 3): storefront แค่ poll ว่า cart ถูก complete แล้วหรือยัง
describe("promptPayPollState", () => {
  it("cart ที่ completed แล้ว = paid", () => {
    expect(promptPayPollState({ completed_at: "2026-10-25T00:00:00Z" })).toBe("paid")
  })

  it("session ถูกยกเลิกหรือ error = failed", () => {
    for (const status of ["canceled", "error"]) {
      expect(
        promptPayPollState({
          completed_at: null,
          payment_collection: { payment_sessions: [{ status }] },
        })
      ).toBe("failed")
    }
  })

  it("ยังไม่ชำระ = pending", () => {
    expect(
      promptPayPollState({
        completed_at: null,
        payment_collection: { payment_sessions: [{ status: "pending" }] },
      })
    ).toBe("pending")
    expect(promptPayPollState(null)).toBe("pending")
  })
})

describe("promptPayQrImage", () => {
  it("อ่าน URL รูป QR จาก next_action ของ PaymentIntent ที่ requires_action", () => {
    expect(
      promptPayQrImage({
        status: "requires_action",
        next_action: {
          type: "promptpay_display_qr_code",
          promptpay_display_qr_code: { image_url_png: "https://qr.stripe.com/x.png", image_url_svg: "https://qr.stripe.com/x.svg" },
        },
      })
    ).toBe("https://qr.stripe.com/x.svg")
  })

  it("ไม่มี QR (ยังไม่ confirm หรือสถานะอื่น) = null", () => {
    expect(promptPayQrImage({ status: "requires_payment_method", next_action: null })).toBeNull()
    expect(promptPayQrImage(undefined)).toBeNull()
  })
})

// review PR #48 blocker 2: หมดเวลาพร้อมกับที่ชำระสำเร็จ → ห้ามลบ session (เงินถูกตัดแต่ไม่มี order)
describe("promptPayExpiryAction", () => {
  it("PaymentIntent succeeded/processing → poll ต่อจน webhook complete cart", () => {
    expect(promptPayExpiryAction("succeeded")).toBe("keep-polling")
    expect(promptPayExpiryAction("processing")).toBe("keep-polling")
  })

  it("ยังไม่ชำระหรืออ่านสถานะไม่ได้ → ยกเลิก session แล้วให้ลองใหม่", () => {
    expect(promptPayExpiryAction("requires_action")).toBe("reset")
    expect(promptPayExpiryAction("requires_payment_method")).toBe("reset")
    expect(promptPayExpiryAction("canceled")).toBe("reset")
    expect(promptPayExpiryAction(undefined)).toBe("reset")
  })
})

// review PR #48 nit: deadline อิงเวลาสร้าง PaymentIntent (วินาที) ไม่ตั้งใหม่ตอน reload
describe("promptPayDeadline", () => {
  it("= created + 10 นาที (ms)", () => {
    expect(promptPayDeadline(1_800_000_000)).toBe(1_800_000_000_000 + PROMPTPAY_TIMEOUT_MS)
  })
})

// PAY-6b (spec 06 กฎข้อ 7A, AC-12/AC-12b): guard ของ backend ตอบ 409 PAYMENT_ALREADY_COMPLETED แทนการลบ session ที่ชำระแล้ว
describe("promptPayRenewalOutcome", () => {
  it("409 + code PAYMENT_ALREADY_COMPLETED → already-paid (poll ต่อ + complete cart ทางสำรอง)", () => {
    expect(
      promptPayRenewalOutcome(409, { type: "conflict", code: "PAYMENT_ALREADY_COMPLETED", message: "x" })
    ).toBe("already-paid")
  })

  it("error อื่น → error (พฤติกรรมเดิม: แสดงหมดอายุ + ข้อความ error)", () => {
    expect(promptPayRenewalOutcome(409, { type: "conflict", code: "PROMOTION_EXCLUSIVE_CONFLICT" })).toBe("error")
    expect(promptPayRenewalOutcome(409, { message: "conflict" })).toBe("error")
    expect(promptPayRenewalOutcome(500, { code: "PAYMENT_ALREADY_COMPLETED" })).toBe("error")
    expect(promptPayRenewalOutcome(409, null)).toBe("error")
    expect(promptPayRenewalOutcome(409, "PAYMENT_ALREADY_COMPLETED")).toBe("error")
  })
})

describe("promptPaySession", () => {
  it("ใช้ session pending (ยังไม่ชำระ)", () => {
    const pending = { id: "a", status: "pending" }
    expect(promptPaySession([{ id: "x", status: "canceled" }, pending])).toBe(pending)
  })

  it("session authorized (guard authorize แล้วแต่ cart ยังไม่ complete) → ใช้ session นั้นเพื่อ complete cart ต่อ", () => {
    const authorized = { id: "b", status: "authorized" }
    expect(promptPaySession([authorized])).toBe(authorized)
  })

  it("ไม่มี session ที่ใช้ได้ → undefined", () => {
    expect(promptPaySession([{ id: "c", status: "canceled" }])).toBeUndefined()
    expect(promptPaySession(undefined)).toBeUndefined()
  })
})
