import { MedusaError } from "@medusajs/framework/utils"
import { assertMaxUnitsWithinMaxQuantity, isMaxUnitsWithinMaxQuantity } from "../utils/max-units"

// spec 04 กฎข้อ 46 (GB-23): มีทั้งสองค่า → max_units_per_person ≤ max_quantity; ขาดตัวใดตัวหนึ่ง → ผ่าน
describe("isMaxUnitsWithinMaxQuantity", () => {
  it.each([
    [2, 2, true],
    [1, 2, true],
    [3, 2, false],
    [null, 2, true],
    [undefined, 2, true],
    [5, null, true],
    [5, undefined, true],
    [null, null, true],
  ])("max_units_per_person=%p, max_quantity=%p → %p", (maxUnits, maxQuantity, expected) => {
    expect(isMaxUnitsWithinMaxQuantity(maxUnits, maxQuantity)).toBe(expected)
  })
})

describe("assertMaxUnitsWithinMaxQuantity", () => {
  it("throws invalid_data naming max_units_per_person when it exceeds max_quantity", () => {
    expect(() => assertMaxUnitsWithinMaxQuantity(3, 2)).toThrow(
      expect.objectContaining({
        type: MedusaError.Types.INVALID_DATA,
        message: expect.stringContaining("max_units_per_person"),
      })
    )
  })

  it("does not throw when within the limit or a value is missing", () => {
    expect(() => assertMaxUnitsWithinMaxQuantity(2, 2)).not.toThrow()
    expect(() => assertMaxUnitsWithinMaxQuantity(9, null)).not.toThrow()
  })
})
