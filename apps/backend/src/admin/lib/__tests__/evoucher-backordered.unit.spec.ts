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
    expect(backorderedItems(items).map((i) => i.id)).toEqual(["a"])
  })

  it("handles an order without items", () => {
    expect(backorderedItems(undefined)).toEqual([])
    expect(backorderedItems(null)).toEqual([])
  })
})
