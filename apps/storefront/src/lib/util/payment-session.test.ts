import { describe, expect, it } from "vitest"

import {
  PROMPTPAY_FALLBACK_MAX_REQUESTS,
  PROMPTPAY_TIMEOUT_MS,
  promptPayFallbackAllowed,
  promptPayFallbackCanPoll,
  formatCountdown,
  isPromptPay,
  paymentSessionData,
  promptPayDeadline,
  promptPayExpiryAction,
  promptPayPollState,
  promptPayPollAction,
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

const PP = "pp_stripe-promptpay_stripe"

describe("promptPaySession", () => {
  it("ใช้ session pending (ยังไม่ชำระ)", () => {
    const pending = { id: "a", status: "pending", provider_id: PP }
    expect(promptPaySession([{ id: "x", status: "canceled", provider_id: PP }, pending])).toBe(pending)
  })

  it("session authorized (guard authorize แล้วแต่ cart ยังไม่ complete) → ใช้ session นั้นเพื่อ complete cart ต่อ", () => {
    const authorized = { id: "b", status: "authorized", provider_id: PP }
    expect(promptPaySession([authorized])).toBe(authorized)
  })

  it("ไม่ใช้ session ของ provider อื่น (เช่นบัตรที่ authorized) — review #98", () => {
    const card = { id: "card", status: "authorized", provider_id: "pp_stripe_stripe" }
    expect(promptPaySession([card])).toBeUndefined()
    const pp = { id: "pp", status: "pending", provider_id: PP }
    expect(promptPaySession([card, pp])).toBe(pp)
  })

  it("ไม่มี session ที่ใช้ได้ → undefined", () => {
    expect(promptPaySession([{ id: "c", status: "canceled", provider_id: PP }])).toBeUndefined()
    expect(promptPaySession(undefined)).toBeUndefined()
  })
})

// AC-12b: ระหว่างรอ order หลังได้ 409 (completeFallback) poll ที่ยัง pending ต้องลอง complete cart ซ้ำ (complete รอบก่อนล้ม/webhook ไม่มา)
describe("promptPayPollAction", () => {
  it("cart complete แล้ว → complete (ได้ order เดิมแล้ว redirect)", () => {
    expect(promptPayPollAction("paid", false)).toBe("complete")
    expect(promptPayPollAction("paid", true)).toBe("complete")
  })

  it("ยัง pending: โหมดทางสำรอง → ลอง complete ซ้ำ; ปกติ → รอ webhook", () => {
    expect(promptPayPollAction("pending", true)).toBe("complete")
    expect(promptPayPollAction("pending", false)).toBe("wait")
  })

  it("session ล้ม → fail", () => {
    expect(promptPayPollAction("failed", false)).toBe("fail")
    expect(promptPayPollAction("failed", true)).toBe("fail")
  })
})

// PAY-6c (spec 06 กฎข้อ 8, AC-17): Medusa compensatePaymentIfNeededStep refund เมื่อ complete ล้มหลัง capture
// สัญญาณจาก Store API: payment_collection.refunded_amount ครอบยอดที่ capture แล้ว (cart ยังไม่ complete)
describe("promptPayPollState — เงินถูกคืน (PAY-6c)", () => {
  it("captured แล้วถูก refund เต็มยอด และ cart ยังไม่ complete = refunded", () => {
    expect(
      promptPayPollState({
        completed_at: null,
        payment_collection: {
          captured_amount: 600,
          refunded_amount: 600,
          payment_sessions: [{ status: "pending" }],
        },
      })
    ).toBe("refunded")
  })

  it("cart complete แล้วมาก่อนเสมอ = paid", () => {
    expect(
      promptPayPollState({
        completed_at: "2026-10-27T00:00:00Z",
        payment_collection: { captured_amount: 600, refunded_amount: 600 },
      })
    ).toBe("paid")
  })

  it("ยังไม่ refund / refund ไม่ครบยอดที่ capture (เช่นชำระรอบใหม่หลังคืนเงิน) / ไม่มี capture = ไม่ใช่ refunded", () => {
    const state = (captured_amount?: number | null, refunded_amount?: number | null) =>
      promptPayPollState({
        completed_at: null,
        payment_collection: { captured_amount, refunded_amount, payment_sessions: [{ status: "authorized" }] },
      })
    expect(state(600, 0)).toBe("pending")
    expect(state(1200, 600)).toBe("pending")
    expect(state(0, 0)).toBe("pending")
    expect(state(null, null)).toBe("pending")
    expect(state(undefined, undefined)).toBe("pending")
  })
})

describe("promptPayPollAction — เงินถูกคืน (PAY-6c)", () => {
  it("โหมดทางสำรอง + refunded → refunded (หยุด complete cart และให้เริ่มชำระใหม่)", () => {
    expect(promptPayPollAction("refunded", true)).toBe("refunded")
  })

  it("ไม่ใช่โหมดทางสำรอง (เช่นกำลังแสดง QR รอบใหม่หลังคืนเงิน) → รอ webhook ต่อ", () => {
    expect(promptPayPollAction("refunded", false)).toBe("wait")
  })
})

// PAY-6c (spec 06 กฎข้อ 8): complete cart + poll ของทางสำรองรวมไม่เกิน 10 ครั้ง
describe("promptPayFallbackAllowed (เพดานทางสำรอง)", () => {
  it("เพดานคือ 10 request", () => {
    expect(PROMPTPAY_FALLBACK_MAX_REQUESTS).toBe(10)
  })

  it("ใช้ไป 0..9 ครั้ง → ยิงได้อีก; ครบ 10 → หยุด", () => {
    for (let used = 0; used < 10; used++) {
      expect(promptPayFallbackAllowed(used)).toBe(true)
    }
    expect(promptPayFallbackAllowed(10)).toBe(false)
    expect(promptPayFallbackAllowed(11)).toBe(false)
  })

  // review #136 nit 1: poll ต้องเหลือ slot ให้ complete เสมอ — poll ครั้งสุดท้ายได้ paid แล้วต้อง complete ไปหน้า confirmed ได้
  it("poll ได้เมื่อยังเหลืออย่างน้อย 2 slot (poll + complete)", () => {
    for (let used = 0; used <= 8; used++) {
      expect(promptPayFallbackCanPoll(used)).toBe(true)
    }
    expect(promptPayFallbackCanPoll(9)).toBe(false)
    expect(promptPayFallbackCanPoll(10)).toBe(false)
  })

  // จำลอง loop ของ component: complete ทันทีหลัง 409 แล้วทุกรอบ poll (ถ้าเหลือ ≥ 2 slot) ตามด้วย complete
  const simulate = (stateAt: (pollNo: number) => "pending" | "paid") => {
    let used = 0
    let polls = 0
    const completes: number[] = []
    const complete = () => {
      if (!promptPayFallbackAllowed(used)) return false
      used++
      completes.push(used)
      return true
    }
    complete()
    for (let pollNo = 1; pollNo < 50; pollNo++) {
      if (!promptPayFallbackCanPoll(used)) break
      used++
      polls++
      const state = stateAt(pollNo)
      if (promptPayPollAction(state, true) === "complete" && !complete()) break
      if (state === "paid") return { used, polls, completes, completedAfterPaid: true }
    }
    return { used, polls, completes, completedAfterPaid: false }
  }

  it("complete ล้มตลอด → ยิงรวมไม่เกิน 10", () => {
    const run = simulate(() => "pending")
    // complete 1 + (poll + complete) × 4 = 9 — slot ที่ 10 ใช้ poll ไม่ได้เพราะจะไม่เหลือให้ complete
    expect(run.used).toBeLessThanOrEqual(10)
    expect(run.used).toBe(9)
    expect(run.completes.at(-1)).toBe(run.used)
  })

  it("poll ครั้งไหนก็ตามที่เห็น paid (รวมครั้งสุดท้ายก่อนเพดาน) → ยัง complete ได้ ไม่ค้างที่ delayed ทั้งที่มี order", () => {
    const pollsWhenPending = simulate(() => "pending").polls
    expect(pollsWhenPending).toBeGreaterThan(0)
    for (let k = 1; k <= pollsWhenPending; k++) {
      const run = simulate((pollNo) => (pollNo === k ? "paid" : "pending"))
      expect(run.completedAfterPaid, `paid ที่ poll ลำดับ ${k}`).toBe(true)
      expect(run.used).toBeLessThanOrEqual(10)
    }
  })
})
