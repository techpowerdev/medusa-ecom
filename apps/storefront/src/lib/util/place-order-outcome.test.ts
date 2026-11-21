import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS, OUT_OF_STOCK, REFUNDED_NOTICE } from "./checkout-error"
import { INSUFFICIENT_INVENTORY_MESSAGE } from "./insufficient-inventory"
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
const fetchError = (message: string, status: number) => new FetchError(message, "x", status)
const text = (code: string) => CHECKOUT_CONFLICTS.find((c) => c.code === code)!.text

describe("placeOrderOutcome", () => {
  it.each([
    ["409 FLASH_SOLD_OUT", fetchError("This flash sale is sold out", 409), "FLASH_SOLD_OUT"],
    ["409 FLASH_LIMIT_EXCEEDED", fetchError("Flash sale limit per customer exceeded", 409), "FLASH_LIMIT_EXCEEDED"],
    [
      "409 PROMOTION_NOT_COMBINABLE",
      fetchError("This promotion can't be combined with the promotions already on the cart", 409),
      "PROMOTION_NOT_COMBINABLE",
    ],
    ["409 code ใน body (ไม่ใช่ FetchError)", { status: 409, code: "FLASH_SOLD_OUT", message: "x" }, "FLASH_SOLD_OUT"],
    ["400 สต็อกไม่พอตอน reserveInventory", fetchError("Not enough stock available for item iitem_1 at location sloc_1", 400), OUT_OF_STOCK],
    ["400 insufficient_inventory", fetchError("Some variant does not have the required inventory", 400), OUT_OF_STOCK],
  ])("%s → refunded", (_label, error, code) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "refunded", code })
  })

  it.each([
    ["FetchError ข้อความของ backend", fetchError(CART_COMPLETION_IN_PROGRESS.message, 409)],
    ["มี code", { status: 409, code: CART_COMPLETION_IN_PROGRESS.code, message: "x" }],
  ])("409 cart already being completed (%s) → processing", (_label, error) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "processing" })
  })

  it.each([
    ["401", fetchError("Unauthorized", 401)],
    ["403", fetchError("Forbidden", 403)],
  ])("%s → unauthorized", (_label, error) => {
    expect(placeOrderOutcome(error)).toEqual({ kind: "unauthorized" })
  })

  it.each([
    ["400 not_allowed นอก allow-list", fetchError("Payment sessions are required", 400)],
    ["409 ไม่มี code ของเรา (ข้อความกลางของ Medusa)", fetchError("The request conflicted with another request.", 409)],
    ["ข้อความ already being completed แต่ไม่ใช่ 409", fetchError(CART_COMPLETION_IN_PROGRESS.message, 400)],
    ["500", fetchError("An unknown error occurred.", 500)],
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
