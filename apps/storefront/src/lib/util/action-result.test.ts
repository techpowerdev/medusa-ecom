import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import { actionErrorMessage, actionFailure } from "@lib/util/action-result"
import { CHECKOUT_CONFLICTS } from "@lib/util/checkout-error"
import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"

// CORE-4i (spec 01 กฎข้อ 72, AC-110): helper กลางแปลง error ของ SDK → ผลแบบมีโครงสร้างของ server action
// และแปลงผล → ข้อความไทยฝั่ง UI (unauthorized ใช้ SIGN_IN_AGAIN_MESSAGE ตัวเดียวทั้งเว็บ)
const NOT_COMBINABLE = CHECKOUT_CONFLICTS.find((c) => c.code === "PROMOTION_NOT_COMBINABLE")!

describe("actionFailure (กฎข้อ 72)", () => {
  it.each([401, 403])("FetchError %i → { error: \"unauthorized\" }", (status) => {
    expect(actionFailure(new FetchError("Unauthorized", "Unauthorized", status))).toEqual({
      error: "unauthorized",
    })
  })

  it.each([
    ["FetchError 500", new FetchError("An unknown error occurred.", "Internal Server Error", 500)],
    ["network", new TypeError("fetch failed")],
    ["ค่าที่ไม่ใช่ object", "boom"],
    ["null", null],
  ])("%s → { error: \"failed\" }", (_label, error) => {
    expect(actionFailure(error)).toEqual({ error: "failed" })
  })

  it("409 ที่ code อยู่ในรายการที่ผู้เรียกแยก → คืน code นั้น (FetchError ไม่มี code จึงเทียบข้อความของ backend)", () => {
    const error = new FetchError(NOT_COMBINABLE.message, "Conflict", 409)
    expect(actionFailure(error, ["PROMOTION_NOT_COMBINABLE"])).toEqual({
      error: "PROMOTION_NOT_COMBINABLE",
    })
  })

  it("code ที่ผู้เรียกไม่ได้ขอแยก → \"failed\"", () => {
    const error = new FetchError(NOT_COMBINABLE.message, "Conflict", 409)
    expect(actionFailure(error)).toEqual({ error: "failed" })
  })

  it("object ที่มี code (ผลของ fetch ตรง) → คืน code ที่ขอแยก", () => {
    expect(actionFailure({ status: 409, code: "FLASH_SOLD_OUT" }, ["FLASH_SOLD_OUT"])).toEqual({
      error: "FLASH_SOLD_OUT",
    })
  })

  it("401 ชนะ code เสมอ", () => {
    expect(actionFailure({ status: 401, code: "FLASH_SOLD_OUT" }, ["FLASH_SOLD_OUT"])).toEqual({
      error: "unauthorized",
    })
  })
})

describe("actionErrorMessage (กฎข้อ 72)", () => {
  it("unauthorized → SIGN_IN_AGAIN_MESSAGE", () => {
    expect(actionErrorMessage("unauthorized", "ล้มเหลว")).toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("failed → fallback ของผู้เรียก", () => {
    expect(actionErrorMessage("failed", "ล้มเหลว")).toBe("ล้มเหลว")
  })

  it("code ของ 409 ที่รู้จัก → ข้อความไทยของ code นั้น", () => {
    expect(actionErrorMessage("PROMOTION_NOT_COMBINABLE", "ล้มเหลว")).toBe(NOT_COMBINABLE.text)
  })
})

describe("settleAction (ฝั่ง client)", () => {
  it("action reject → { error: \"failed\" }; resolve → ผลเดิม", async () => {
    const { settleAction } = await import("@lib/util/action-result")
    await expect(settleAction(Promise.reject(new Error("boom")))).resolves.toEqual({ error: "failed" })
    await expect(settleAction(Promise.resolve({ ok: true }))).resolves.toEqual({ ok: true })
  })
})
