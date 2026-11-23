import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS, OUT_OF_STOCK, REFUNDED_NOTICE } from "./checkout-error"
import { INSUFFICIENT_INVENTORY_MESSAGE } from "./insufficient-inventory"
import { MedusaApiError } from "./medusa-api-error"
import {
  CART_COMPLETION_IN_PROGRESS,
  PROCESSING_NOTICE,
  PROMOTION_REFUNDED_NOTICE,
  checkoutNotice,
  placeOrderOutcome,
} from "./place-order-outcome"

// CORE-76 (spec 01 กฎข้อ 134 a2, AC-175 a2): ผลของ complete cart จัดเป็น kind ด้วย allow-list — `refunded` เฉพาะ error ที่รู้แน่ว่า
// workflow ล้มหลัง capture แล้ว Medusa คืนเงิน; 409 CART_COMPLETION_IN_PROGRESS → processing; 401/403 → unauthorized; อื่นๆ → failed
const THAI = /[฀-๿]/
// CORE-82 (กฎข้อ 140, ADR-028): error ของ medusaFetch — ตัดสินจาก code; ไม่มี code ใช้ได้เฉพาะข้อยกเว้นของ helper
const apiError = (status: number, message: string, code: string | null = null, type: string | null = null) =>
  new MedusaApiError({ status, type, code, message })
const conflict = (code: string) => apiError(409, "x", code, "conflict")
const text = (code: string) => CHECKOUT_CONFLICTS.find((c) => c.code === code)!.text

describe("placeOrderOutcome", () => {
  it.each([
    ["409 FLASH_SOLD_OUT", conflict("FLASH_SOLD_OUT"), "FLASH_SOLD_OUT"],
    ["409 FLASH_LIMIT_EXCEEDED", conflict("FLASH_LIMIT_EXCEEDED"), "FLASH_LIMIT_EXCEEDED"],
    ["409 PROMOTION_NOT_COMBINABLE", conflict("PROMOTION_NOT_COMBINABLE"), "PROMOTION_NOT_COMBINABLE"],
    ["409 code ใน object ธรรมดา", { status: 409, code: "FLASH_SOLD_OUT", message: "x" }, "FLASH_SOLD_OUT"],
    [
      "400 สต็อกไม่พอตอน reserveInventory (ไม่มี code — ข้อยกเว้น)",
      apiError(400, "Not enough stock available for item iitem_1 at location sloc_1", null, "not_allowed"),
      OUT_OF_STOCK,
    ],
    ["400 insufficient_inventory", apiError(400, "x", "insufficient_inventory", "not_allowed"), OUT_OF_STOCK],
  ])("%s → refunded", (_label, error, code) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "refunded", code })
  })

  it.each([
    ["MedusaApiError", conflict(CART_COMPLETION_IN_PROGRESS)],
    ["object ธรรมดา", { status: 409, code: CART_COMPLETION_IN_PROGRESS, message: "x" }],
  ])("409 code CART_COMPLETION_IN_PROGRESS (%s) → processing", (_label, error) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "processing" })
  })

  it.each([
    ["401", apiError(401, "Unauthorized")],
    ["403", apiError(403, "Forbidden")],
  ])("%s → unauthorized", (_label, error) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "unauthorized" })
  })

  it.each([
    ["400 not_allowed นอก allow-list", apiError(400, "Payment sessions are required", null, "not_allowed")],
    ["409 ไม่มี code ของเรา (ข้อความกลางของ Medusa)", apiError(409, "The request conflicted with another request.", "invalid_state_error")],
    // CORE-82: ไม่เทียบข้อความแล้ว — ข้อความของ backend ที่ไม่มี code ไม่ได้ kind ของ code นั้น
    ["409 ข้อความ FLASH_SOLD_OUT ไม่มี code", apiError(409, "This flash sale is sold out", null, "conflict")],
    ["409 ข้อความ already being completed ไม่มี code", apiError(409, "Cart is already being completed by another request", null, "conflict")],
    ["400 ข้อความ insufficient inventory ไม่มี code", apiError(400, "Some variant does not have the required inventory", null, "not_allowed")],
    ["400 ข้อความ reserveInventory แต่ type อื่น", apiError(400, "Not enough stock available for item i at location l", null, "invalid_data")],
    ["code CART_COMPLETION_IN_PROGRESS แต่ไม่ใช่ 409", apiError(400, "x", CART_COMPLETION_IN_PROGRESS)],
    ["500", apiError(500, "An unknown error occurred.")],
    ["network", new TypeError("fetch failed")],
    ["null", null],
  ])("%s → failed (ไม่ใช่ refunded)", (_label, error) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "failed" })
  })
})

describe("checkoutNotice(outcome, paid)", () => {
  it.each(["FLASH_SOLD_OUT", "FLASH_LIMIT_EXCEEDED", OUT_OF_STOCK])("ตัดเงินแล้ว + %s → refunded REFUNDED_NOTICE", (code) => {
    expect(checkoutNotice({ kind: "refunded", code }, true)).toEqual({ kind: "refunded", text: REFUNDED_NOTICE })
  })

  it("ตัดเงินแล้ว + PROMOTION_NOT_COMBINABLE → ข้อความคืนเงินของโปรโมชัน (ไม่ใช่ สินค้า/สิทธิ์ราคาพิเศษหมด)", () => {
    expect(checkoutNotice({ kind: "refunded", code: "PROMOTION_NOT_COMBINABLE" }, true)).toEqual({
      kind: "refunded",
      text: PROMOTION_REFUNDED_NOTICE,
    })
    expect(PROMOTION_REFUNDED_NOTICE).toMatch(THAI)
    expect(PROMOTION_REFUNDED_NOTICE).toContain("โปรโมชัน")
    expect(PROMOTION_REFUNDED_NOTICE).toContain("คืนเงิน")
    expect(PROMOTION_REFUNDED_NOTICE).not.toContain("สิทธิ์ราคาพิเศษหมด")
    expect(PROMOTION_REFUNDED_NOTICE).not.toContain("ลองใหม่")
  })

  it("ยังไม่ตัดเงิน (manual) + สต็อกไม่พอ → INSUFFICIENT_INVENTORY_MESSAGE ไม่มีคำ คืนเงิน", () => {
    const notice = checkoutNotice({ kind: "refunded", code: OUT_OF_STOCK }, false)
    expect(notice).toEqual({ kind: "error", text: INSUFFICIENT_INVENTORY_MESSAGE })
    expect(INSUFFICIENT_INVENTORY_MESSAGE).not.toContain("คืนเงิน")
  })

  it.each(["FLASH_SOLD_OUT", "FLASH_LIMIT_EXCEEDED", "PROMOTION_NOT_COMBINABLE"])(
    "ยังไม่ตัดเงิน + %s → ข้อความเดิมของ code",
    (code) => {
      expect(checkoutNotice({ kind: "refunded", code }, false)).toEqual({ kind: "error", text: text(code) })
    }
  )

  it.each([true, false])("processing (paid=%s) → processing", (paid) => {
    expect(checkoutNotice({ kind: "processing" }, paid)).toEqual({ kind: "processing" })
    expect(PROCESSING_NOTICE).toBe("กำลังดำเนินการคำสั่งซื้อ กรุณารอสักครู่")
  })

  it.each([true, false])("failed (paid=%s) → ข้อความ fallback เดิม", (paid) => {
    const notice = checkoutNotice({ kind: "failed" }, paid)
    expect(notice).toEqual({ kind: "error", text: "ยืนยันคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" })
  })
})
