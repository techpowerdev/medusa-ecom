import { isLowStock, toStatusCounts } from "../utils/stats"

describe("toStatusCounts", () => {
  it("groups count rows per pool and fills missing statuses with 0", () => {
    const counts = toStatusCounts(
      ["evpool_a", "evpool_b", "evpool_c"],
      [
        { pool_id: "evpool_a", status: "available", count: "98" },
        { pool_id: "evpool_a", status: "delivered", count: 2 },
        { pool_id: "evpool_b", status: "void", count: "1" },
      ]
    )
    expect(counts).toEqual({
      evpool_a: { available: 98, allocated: 0, delivered: 2, void: 0 },
      evpool_b: { available: 0, allocated: 0, delivered: 0, void: 1 },
      evpool_c: { available: 0, allocated: 0, delivered: 0, void: 0 },
    })
  })

  it("ignores rows of pools that were not requested", () => {
    expect(
      toStatusCounts([], [{ pool_id: "evpool_x", status: "available", count: 1 }])
    ).toEqual({})
  })
})

describe("isLowStock", () => {
  it("is low when available is below the threshold (spec AC-9)", () => {
    expect(isLowStock(19, 20)).toBe(true)
    expect(isLowStock(0, 1)).toBe(true)
  })

  it("is not low at or above the threshold", () => {
    expect(isLowStock(20, 20)).toBe(false)
    expect(isLowStock(0, 0)).toBe(false)
  })
})
