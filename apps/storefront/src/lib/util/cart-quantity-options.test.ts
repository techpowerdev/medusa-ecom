import { describe, expect, it } from "vitest"

import { cartQuantityOptions } from "./cart-quantity-options"

// CORE-44 (spec 01 กฎข้อ 102b, AC-138): ตัวเลือกจำนวนของ line ใน /cart = 1..10 และจำนวนจริงเมื่อ > 10
const ONE_TO_TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

describe("cartQuantityOptions", () => {
  it.each([
    [3, ONE_TO_TEN],
    [10, ONE_TO_TEN],
    [11, [...ONE_TO_TEN, 11]],
    [99, [...ONE_TO_TEN, 99]],
  ])("cartQuantityOptions(%i)", (quantity, expected) => {
    const options = cartQuantityOptions(quantity)
    expect(options).toEqual(expected)
    expect(new Set(options).size).toBe(options.length)
    expect([...options].sort((a, b) => a - b)).toEqual(options)
  })
})
