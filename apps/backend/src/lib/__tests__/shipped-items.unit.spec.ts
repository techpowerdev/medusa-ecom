import { toShippedItems } from "../shipped-items"

// CORE-11 (spec 01 กฎข้อ 20, AC-32): อีเมล shipped แสดงเฉพาะ item และจำนวนที่อยู่ใน fulfillment นั้น
describe("toShippedItems", () => {
  const orderItems = [
    { id: "ordli_a", product_title: "Thai Tea", variant_title: "500g", title: "500g", quantity: 2, total: 500 },
    { id: "ordli_b", product_title: "Green Tea", variant_title: "250g", title: "250g", quantity: 1, total: 150 },
  ]

  it("keeps only the line items in the fulfillment with the fulfilled quantity", () => {
    expect(toShippedItems(orderItems, [{ line_item_id: "ordli_a", quantity: 1 }])).toEqual([
      { id: "ordli_a", product_title: "Thai Tea", variant_title: "500g", title: "500g", quantity: 1 },
    ])
  })

  it("does not carry the order line totals (they cover the full order quantity)", () => {
    const [item] = toShippedItems(orderItems, [{ line_item_id: "ordli_a", quantity: 1 }])
    expect(item).not.toHaveProperty("total")
  })

  it("sums fulfillment items of the same line and keeps the order's item order", () => {
    expect(
      toShippedItems(orderItems, [
        { line_item_id: "ordli_b", quantity: 1 },
        { line_item_id: "ordli_a", quantity: 1 },
        { line_item_id: "ordli_a", quantity: "1" },
      ]).map(({ id, quantity }) => ({ id, quantity }))
    ).toEqual([
      { id: "ordli_a", quantity: 2 },
      { id: "ordli_b", quantity: 1 },
    ])
  })

  it("returns nothing for a fulfillment without items or with unknown lines", () => {
    expect(toShippedItems(orderItems, [])).toEqual([])
    expect(toShippedItems(orderItems, null)).toEqual([])
    expect(toShippedItems(orderItems, [{ line_item_id: "ordli_x", quantity: 1 }, null])).toEqual([])
    expect(toShippedItems(null, [{ line_item_id: "ordli_a", quantity: 1 }])).toEqual([])
  })
})
