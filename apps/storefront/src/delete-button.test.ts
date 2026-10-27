import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import DeleteButton, { removeLineItem } from "@modules/common/components/delete-button"

// CORE-19c (spec 01 กฎข้อ 64, AC-100): DeleteButton ส่งต่อ data-testid ที่ผู้เรียกส่งมาไปที่ <button>
// (ส่วนแสดง error เมื่อลบล้มตรวจด้วย e2e `e2e/core-19c-delete-button-error.spec.ts`)
const deleteLineItem = vi.fn()
const notifyCartUpdated = vi.fn()
vi.mock("@lib/data/cart", () => ({ deleteLineItem: (...a: unknown[]) => deleteLineItem(...a) }))
vi.mock("@lib/util/cart-events", () => ({ notifyCartUpdated: () => notifyCartUpdated() }))

const THAI = /[฀-๿]/

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(DeleteButton, { id: "line_1", ...props } as never, "ลบ"))

describe("DeleteButton (กฎข้อ 64)", () => {
  it("ส่งต่อ data-testid ไปที่ <button>", () => {
    expect(render({ "data-testid": "cart-item-remove-button" })).toMatch(
      /<button[^>]*data-testid="cart-item-remove-button"/
    )
  })

  it("ไม่แสดง cart-item-remove-error ก่อนกดลบ", () => {
    expect(render({ "data-testid": "x" })).not.toContain("cart-item-remove-error")
  })
})

// CORE-19d (spec 01 กฎข้อ 68, AC-104): ข้อความใน `cart-item-remove-error` มาจาก `removeLineItem`
// (handler ของปุ่ม) — unauthorized ให้เข้าสู่ระบบใหม่ ต่างจากข้อความ fallback ของกรณีอื่น
describe("DeleteButton แยก unauthorized (กฎข้อ 68)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("unauthorized กับ failed ได้ข้อความไทยต่างกัน และไม่แจ้ง cart อัปเดต", async () => {
    deleteLineItem.mockResolvedValueOnce({ error: "unauthorized" })
    const unauthorized = await removeLineItem("line_1")
    deleteLineItem.mockResolvedValueOnce({ error: "failed" })
    const failed = await removeLineItem("line_1")

    expect(unauthorized).toMatch(THAI)
    expect(unauthorized).toContain("เข้าสู่ระบบใหม่")
    expect(failed).toMatch(THAI)
    expect(failed).not.toContain("เข้าสู่ระบบ")
    expect(unauthorized).not.toBe(failed)
    expect(notifyCartUpdated).not.toHaveBeenCalled()
  })

  it("action reject (เช่น request ของ action ตอบ 500) → ข้อความ fallback เดียวกับ failed", async () => {
    deleteLineItem.mockResolvedValueOnce({ error: "failed" })
    const failed = await removeLineItem("line_1")
    deleteLineItem.mockRejectedValueOnce(new Error("An error occurred in the Server Components render"))
    await expect(removeLineItem("line_1")).resolves.toBe(failed)
  })

  it("สำเร็จ → ไม่มีข้อความ error และแจ้ง cart อัปเดต", async () => {
    deleteLineItem.mockResolvedValueOnce({ ok: true })
    await expect(removeLineItem("line_1")).resolves.toBeNull()
    expect(deleteLineItem).toHaveBeenCalledWith("line_1")
    expect(notifyCartUpdated).toHaveBeenCalledTimes(1)
  })
})
