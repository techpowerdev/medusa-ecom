import { backorderedItems } from "../evoucher-status"

// EV-22 (กฎข้อ 38b): line ที่ยังค้าง code คือ line ที่ metadata.evoucher_backordered === true (ค่าที่ถูกล้างเป็น key หาย)
describe("backorderedItems", () => {
  it("returns only lines flagged with evoucher_backordered=true", () => {
    const items = [
      { id: "a", metadata: { evoucher_backordered: true } },
      { id: "b", metadata: {} },
      { id: "c", metadata: null },
      { id: "d", metadata: { evoucher_backordered: "" } },
      { id: "e" },
    ]
    expect(backorderedItems({ status: "completed", items }).map((i) => i.id)).toEqual(["a"])
  })

  it("handles an order without items", () => {
    expect(backorderedItems({ status: "pending", items: undefined })).toEqual([])
    expect(backorderedItems({ status: "pending", items: null })).toEqual([])
  })

  // qa #446 (session หลักตัดสิน 2026-11-21): order ที่ยกเลิกแล้วไม่ต้องรอ code — ธงที่ค้างอยู่ไม่ขึ้น badge
  it("returns nothing for a canceled order even when lines are still flagged", () => {
    const items = [{ id: "a", metadata: { evoucher_backordered: true } }]
    expect(backorderedItems({ status: "canceled", items })).toEqual([])
  })
})
