import { toShippedItems } from "../shipped-items"

// CORE-11 (spec 01 กฎข้อ 20, AC-32): อีเมล shipped แสดงเฉพาะ item และจำนวนที่อยู่ใน fulfillment นั้น
// Medusa (createOrderFulfillmentWorkflow) สร้าง fulfillment item 1 แถวต่อ inventory item ของ variant
// โดย quantity = required_quantity × จำนวนที่ส่ง — แถวที่ไม่มี inventory_item_id (variant ไม่ manage inventory) ใช้ quantity ตรงๆ
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

  it("keeps the order's item order", () => {
    expect(
      toShippedItems(orderItems, [
        { line_item_id: "ordli_b", quantity: 1 },
        { line_item_id: "ordli_a", quantity: "2" },
      ]).map(({ id, quantity }) => ({ id, quantity }))
    ).toEqual([
      { id: "ordli_a", quantity: 2 },
      { id: "ordli_b", quantity: 1 },
    ])
  })

  it("counts a kit of 2 inventory items shipped once as 1 unit (one fulfillment item per inventory item)", () => {
    const kit = [
      {
        id: "ordli_kit",
        title: "Gift set",
        quantity: 1,
        variant: {
          inventory_items: [
            { inventory_item_id: "iitem_cup", required_quantity: 1 },
            { inventory_item_id: "iitem_tea", required_quantity: 1 },
          ],
        },
      },
    ]

    expect(
      toShippedItems(kit, [
        { line_item_id: "ordli_kit", inventory_item_id: "iitem_cup", quantity: 1 },
        { line_item_id: "ordli_kit", inventory_item_id: "iitem_tea", quantity: 1 },
      ])
    ).toEqual([{ id: "ordli_kit", title: "Gift set", quantity: 1 }])
  })

  it("divides by required_quantity (variant needs 2 of an inventory item, 3 units shipped → row quantity 6)", () => {
    const pack = [
      {
        id: "ordli_pack",
        title: "Twin pack",
        quantity: 3,
        variant: {
          inventory_items: [
            { inventory_item_id: "iitem_bottle", required_quantity: 2 },
            { inventory_item_id: "iitem_box", required_quantity: 1 },
          ],
        },
      },
    ]

    expect(
      toShippedItems(pack, [
        { line_item_id: "ordli_pack", inventory_item_id: "iitem_bottle", quantity: 6 },
        { line_item_id: "ordli_pack", inventory_item_id: "iitem_box", quantity: "3" },
      ]).map(({ quantity }) => quantity)
    ).toEqual([3])
  })

  it("sums rows of the same inventory item of a line (e.g. reservations split by location)", () => {
    const pack = [
      {
        id: "ordli_pack",
        quantity: 3,
        variant: { inventory_items: [{ inventory_item_id: "iitem_bottle", required_quantity: 2 }] },
      },
    ]

    expect(
      toShippedItems(pack, [
        { line_item_id: "ordli_pack", inventory_item_id: "iitem_bottle", quantity: 2 },
        { line_item_id: "ordli_pack", inventory_item_id: "iitem_bottle", quantity: 4 },
      ]).map(({ quantity }) => quantity)
    ).toEqual([3])
  })

  it("returns nothing for a fulfillment without items or with unknown lines", () => {
    expect(toShippedItems(orderItems, [])).toEqual([])
    expect(toShippedItems(orderItems, null)).toEqual([])
    expect(toShippedItems(orderItems, [{ line_item_id: "ordli_x", quantity: 1 }, null])).toEqual([])
    expect(toShippedItems(null, [{ line_item_id: "ordli_a", quantity: 1 }])).toEqual([])
  })
})
