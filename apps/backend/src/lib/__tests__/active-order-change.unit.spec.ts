import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { findActiveOrderChangeOfPayment } from "../active-order-change"

// PAY-8 (spec 06 กฎข้อ 10a/b): หา order ของ payment (payment → payment collection → order_payment_collection)
// แล้วหา order_change ที่ status pending/requested (ค่าเดียวกับที่ order module ของ Medusa ใช้ตรวจ active order change)
type GraphCall = { entity: string; fields: string[]; filters: Record<string, unknown> }

const fakeQuery = (rows: Record<string, unknown[]>) => {
  const calls: GraphCall[] = []
  const query = {
    graph: async (config: GraphCall) => {
      calls.push(config)
      return { data: rows[config.entity] ?? [] }
    },
  } as unknown as Pick<RemoteQueryFunction, "graph">
  return { query, calls }
}

describe("findActiveOrderChangeOfPayment", () => {
  it("returns null when the payment does not exist (the route answers 404 as before)", async () => {
    const { query, calls } = fakeQuery({})
    await expect(findActiveOrderChangeOfPayment(query, "pay_missing")).resolves.toBeNull()
    expect(calls.map((c) => c.entity)).toEqual(["payment"])
  })

  it("returns null when the payment collection has no order (rule 10a)", async () => {
    const { query, calls } = fakeQuery({ payment: [{ id: "pay_1", payment_collection_id: "pay_col_1" }] })
    await expect(findActiveOrderChangeOfPayment(query, "pay_1")).resolves.toBeNull()
    expect(calls[1]).toMatchObject({
      entity: "order_payment_collection",
      filters: { payment_collection_id: "pay_col_1" },
    })
    expect(calls).toHaveLength(2)
  })

  it("looks only for pending/requested order changes of the order", async () => {
    const { query, calls } = fakeQuery({
      payment: [{ id: "pay_1", payment_collection_id: "pay_col_1" }],
      order_payment_collection: [{ order_id: "order_1" }],
    })
    await expect(findActiveOrderChangeOfPayment(query, "pay_1")).resolves.toBeNull()
    expect(calls[2]).toMatchObject({
      entity: "order_change",
      filters: { order_id: "order_1", status: ["pending", "requested"] },
    })
  })

  it("returns the active order change of the payment's order (rule 10b)", async () => {
    const { query } = fakeQuery({
      payment: [{ id: "pay_1", payment_collection_id: "pay_col_1" }],
      order_payment_collection: [{ order_id: "order_1" }],
      order_change: [{ id: "ordch_1", change_type: "return_request", status: "requested" }],
    })
    await expect(findActiveOrderChangeOfPayment(query, "pay_1")).resolves.toEqual({
      id: "ordch_1",
      change_type: "return_request",
      status: "requested",
      order_id: "order_1",
    })
  })
})
