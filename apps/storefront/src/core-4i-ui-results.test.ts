import { beforeEach, describe, expect, it, vi } from "vitest"

import { CHECKOUT_CONFLICTS } from "@lib/util/checkout-error"
import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import { removeLineItem } from "@modules/common/components/delete-button"
import { submitPromotionCodes } from "@modules/checkout/components/discount-code"
import { changeLineQuantity } from "@modules/cart/components/item"

// CORE-4i-a (spec 01 กฎข้อ 72, AC-110): handler ของ UI อ่านผลที่ action คืน — `unauthorized` แสดง SIGN_IN_AGAIN_MESSAGE
// (ตัวเดียวทั้งเว็บ), action ที่ reject เอง (request ของ action ล้ม) → ข้อความ fallback ไทย ไม่ใช่ข้อความดิบ
const applyPromotions = vi.fn()
const updateLineItem = vi.fn()
const deleteLineItem = vi.fn()
const notifyCartUpdated = vi.fn()
vi.mock("@lib/data/cart", () => ({
  applyPromotions: (...a: unknown[]) => applyPromotions(...a),
  updateLineItem: (...a: unknown[]) => updateLineItem(...a),
  deleteLineItem: (...a: unknown[]) => deleteLineItem(...a),
}))
vi.mock("@lib/util/cart-events", () => ({ notifyCartUpdated: () => notifyCartUpdated() }))

const THAI = /[฀-๿]/
const NOT_COMBINABLE = CHECKOUT_CONFLICTS.find((c) => c.code === "PROMOTION_NOT_COMBINABLE")!
const REJECTED = new Error("An error occurred in the Server Components render")

beforeEach(() => vi.clearAllMocks())

describe("โค้ดส่วนลด (submitPromotionCodes)", () => {
  it("unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(submitPromotionCodes(["A"], "A")).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("PROMOTION_NOT_COMBINABLE → ข้อความไทยของ code นั้น", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "PROMOTION_NOT_COMBINABLE" })
    await expect(submitPromotionCodes(["A", "B"], "B")).resolves.toBe(NOT_COMBINABLE.text)
  })

  it("failed กับ action reject ได้ข้อความ fallback ไทยเดียวกัน", async () => {
    applyPromotions.mockResolvedValueOnce({ error: "failed" })
    const failed = await submitPromotionCodes(["A"], "A")
    applyPromotions.mockRejectedValueOnce(REJECTED)
    await expect(submitPromotionCodes(["A"], "A")).resolves.toBe(failed)
    expect(failed).toMatch(THAI)
    expect(failed).not.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("สำเร็จแต่ code ไม่อยู่ใน cart (กฎข้อ 63b) → ข้อความใช้โค้ดไม่ได้; อยู่ใน cart → \"\"", async () => {
    applyPromotions.mockResolvedValueOnce({ ok: true, codes: [] })
    await expect(submitPromotionCodes(["EXPIRED"], "EXPIRED")).resolves.toMatch(THAI)
    applyPromotions.mockResolvedValueOnce({ ok: true, codes: ["OK10"] })
    await expect(submitPromotionCodes(["ok10"], "ok10")).resolves.toBe("")
  })

  it("ลบโค้ด (ไม่มี code ที่ต้องตรวจ) สำเร็จ → \"\"", async () => {
    applyPromotions.mockResolvedValueOnce({ ok: true, codes: [] })
    await expect(submitPromotionCodes([])).resolves.toBe("")
  })
})

describe("แก้จำนวนในตะกร้า (changeLineQuantity)", () => {
  it("unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    updateLineItem.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(changeLineQuantity("line_1", 2)).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(updateLineItem).toHaveBeenCalledWith({ lineId: "line_1", quantity: 2 })
  })

  it("failed กับ action reject ได้ข้อความ fallback ไทยเดียวกัน", async () => {
    updateLineItem.mockResolvedValueOnce({ error: "failed" })
    const failed = await changeLineQuantity("line_1", 2)
    updateLineItem.mockRejectedValueOnce(REJECTED)
    await expect(changeLineQuantity("line_1", 2)).resolves.toBe(failed)
    expect(failed).toMatch(THAI)
    expect(failed).not.toBe(SIGN_IN_AGAIN_MESSAGE)
  })

  it("สำเร็จ → null", async () => {
    updateLineItem.mockResolvedValueOnce({ ok: true })
    await expect(changeLineQuantity("line_1", 2)).resolves.toBeNull()
  })
})

describe("ลบสินค้า (removeLineItem) ใช้ SIGN_IN_AGAIN_MESSAGE เดียวกัน", () => {
  it("unauthorized → SIGN_IN_AGAIN_MESSAGE", async () => {
    deleteLineItem.mockResolvedValueOnce({ error: "unauthorized" })
    await expect(removeLineItem("line_1")).resolves.toBe(SIGN_IN_AGAIN_MESSAGE)
  })
})
