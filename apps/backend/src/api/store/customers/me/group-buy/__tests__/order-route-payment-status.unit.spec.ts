import { GET } from "../orders/[order_id]/route"

// GB-N3 (spec 04 กฎข้อ 24b, AC-42): null ใน order.payment_collections ต้องไม่ทำให้ getLastPaymentStatus โยน TypeError (500)
// และ payment_status คำนวณจากชุด collection เดียวกับที่คืนใน response
const run = async (paymentCollections: unknown[]) => {
  const row = {
    id: "gbm_1",
    status: "pending_payment",
    units: 1,
    group: { id: "gbg_1", status: "succeeded", ends_at: null, pay_deadline_at: null },
    order: {
      id: "order_1",
      currency_code: "thb",
      items: [],
      payment_collections: paymentCollections,
    },
  }
  const query = { graph: jest.fn().mockResolvedValue({ data: [row] }) }
  const req = {
    scope: { resolve: () => query },
    params: { order_id: "order_1" },
    auth_context: { actor_id: "cus_1" },
  }
  const res = { set: jest.fn(), json: jest.fn() }
  await GET(req as never, res as never)
  return res.json.mock.calls[0][0]
}

const collection = {
  id: "paycol_1",
  amount: 100,
  status: "completed",
  captured_amount: 100,
  refunded_amount: 0,
  payment_sessions: [],
}

describe("GET /store/customers/me/group-buy/orders/:order_id — payment_status", () => {
  it("กรอง null ออกก่อนคำนวณ payment_status ([null, c])", async () => {
    const body = await run([null, collection])
    expect(body.order.payment_status).toBe("captured")
    expect(body.order.payment_collections).toHaveLength(1)
  })

  it("ไม่มี collection ที่ไม่ใช่ null → not_paid", async () => {
    const body = await run([null])
    expect(body.order.payment_status).toBe("not_paid")
    expect(body.order.payment_collections).toHaveLength(0)
  })
})
