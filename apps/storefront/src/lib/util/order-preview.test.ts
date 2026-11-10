import { describe, expect, it } from "vitest"

import { orderPreview } from "./order-preview"

// spec 01 กฎข้อ 43 / AC-79: order card แสดงสูงสุด 3 line และ "+ N รายการ" โดย N = line ที่ไม่ได้แสดง
const lines = (count: number, quantity: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `item_${i}`, quantity }))

describe("orderPreview (AC-79)", () => {
  it("5 line qty 2 → แสดง 3, เหลือ 2", () => {
    const { shown, moreCount } = orderPreview(lines(5, 2))
    expect(shown.map((i) => i.id)).toEqual(["item_0", "item_1", "item_2"])
    expect(moreCount).toBe(2)
  })

  it("4 line qty 1 → เหลือ 1", () => {
    expect(orderPreview(lines(4, 1)).moreCount).toBe(1)
  })

  it("3 line qty 5 → ไม่มีตัวนับ", () => {
    const { shown, moreCount } = orderPreview(lines(3, 5))
    expect(shown).toHaveLength(3)
    expect(moreCount).toBe(0)
  })

  it("ไม่มี items → ว่าง", () => {
    expect(orderPreview(undefined)).toEqual({ shown: [], moreCount: 0 })
  })
})
