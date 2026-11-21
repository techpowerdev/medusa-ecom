import { isLowStock, isPoolLowStock, toStatusCounts, totalCodes } from "../utils/stats"

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

// EV-20 (spec 02 กฎข้อ 36c): pool ที่ไม่มี code เลยไม่ขึ้น "Low stock"
describe("totalCodes / isPoolLowStock", () => {
  const counts = (available: number, rest = 0) => ({ available, allocated: 0, delivered: rest, void: 0 })

  it("counts codes of every status", () => {
    expect(totalCodes({ available: 2, allocated: 1, delivered: 3, void: 4 })).toBe(10)
  })

  it("is not low when the pool has no codes at all", () => {
    expect(isPoolLowStock(counts(0), 20)).toBe(false)
  })

  it("is low when the pool has codes and available is below the threshold", () => {
    expect(isPoolLowStock(counts(5), 20)).toBe(true)
    expect(isPoolLowStock(counts(0, 3), 20)).toBe(true)
    expect(isPoolLowStock(counts(20), 20)).toBe(false)
  })
})
