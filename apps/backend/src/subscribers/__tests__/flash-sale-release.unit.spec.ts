const run = jest.fn().mockResolvedValue({ result: {} })

jest.mock("../../workflows/release-flash-sale-for-order", () => ({
  releaseFlashSaleForOrderWorkflow: jest.fn(() => ({ run })),
}))

import flashSaleReleaseHandler from "../flash-sale-release"

// FS-11 (spec 03 กฎข้อ 16, AC-17): subscriber แค่ส่ง id จาก event เข้า workflow — การหา order/cart_id
// และเกณฑ์ refund เต็มจำนวนอยู่ใน workflow (step มี retry) subscriber ต้องไม่ resolve query/service เอง
describe("flashSaleReleaseHandler", () => {
  const container = {
    resolve: jest.fn(() => {
      throw new Error("subscriber must not resolve anything from the container")
    }),
  }
  const handle = (name: string, id: string) =>
    flashSaleReleaseHandler({ event: { name, data: { id } }, container } as unknown as Parameters<
      typeof flashSaleReleaseHandler
    >[0])

  beforeEach(() => jest.clearAllMocks())

  it("passes the payment id of payment.refunded straight into the workflow", async () => {
    await handle("payment.refunded", "pay_1")

    expect(run).toHaveBeenCalledWith({ input: { payment_id: "pay_1", reason: "refunded" } })
    expect(container.resolve).not.toHaveBeenCalled()
  })

  it("passes the order id of order.canceled straight into the workflow", async () => {
    await handle("order.canceled", "order_1")

    expect(run).toHaveBeenCalledWith({ input: { order_id: "order_1", reason: "canceled" } })
    expect(container.resolve).not.toHaveBeenCalled()
  })
})
