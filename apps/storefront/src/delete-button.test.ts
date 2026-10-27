import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import DeleteButton from "@modules/common/components/delete-button"

// CORE-19c (spec 01 กฎข้อ 64, AC-100): DeleteButton ส่งต่อ data-testid ที่ผู้เรียกส่งมาไปที่ <button>
// (ส่วนแสดง error เมื่อลบล้มตรวจด้วย e2e `e2e/core-19c-delete-button-error.spec.ts`)
vi.mock("@lib/data/cart", () => ({ deleteLineItem: vi.fn() }))

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
