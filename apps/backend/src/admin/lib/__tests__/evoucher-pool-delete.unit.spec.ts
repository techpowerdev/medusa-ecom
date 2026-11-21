import { deletePoolPrompt, poolStockState } from "../evoucher-pool-delete"

// EV-21 (spec 02 กฎข้อ 37): badge สต็อกของ pool — ไม่มี code เลย = "No codes" แทน "Low stock" (กฎข้อ 36c)
describe("poolStockState", () => {
  it("is no_codes when the pool has no codes at all", () => {
    expect(poolStockState({ total_codes: 0, low_stock: false })).toBe("no_codes")
  })

  it("is no_codes even if low_stock is true (older API response)", () => {
    expect(poolStockState({ total_codes: 0, low_stock: true })).toBe("no_codes")
  })

  it("is low when there are codes and low_stock is true", () => {
    expect(poolStockState({ total_codes: 5, low_stock: true })).toBe("low")
  })

  it("is ok otherwise", () => {
    expect(poolStockState({ total_codes: 30, low_stock: false })).toBe("ok")
  })
})

// กฎข้อ 37: prompt ยืนยันระบุจำนวน code ที่จะถูกลบ
describe("deletePoolPrompt", () => {
  it("names the pool and the number of codes that will be deleted", () => {
    const prompt = deletePoolPrompt({ name: "Starbucks 500", total_codes: 6 })
    expect(prompt.title).toBe("Delete Starbucks 500?")
    expect(prompt.description).toContain("6 codes")
    expect(prompt.confirmText).toBe("Delete")
    expect(prompt.cancelText).toBe("Cancel")
  })

  it("uses the singular for one code", () => {
    expect(deletePoolPrompt({ name: "P", total_codes: 1 }).description).toContain("1 code ")
  })

  it("says no codes when the pool is empty", () => {
    expect(deletePoolPrompt({ name: "P", total_codes: 0 }).description).toContain("no codes")
  })
})
