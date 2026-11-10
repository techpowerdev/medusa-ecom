const run = jest.fn()

jest.mock("../../workflows/evoucher/release-evoucher-codes-for-order", () => ({
  releaseEvoucherCodesForOrderWorkflow: jest.fn(() => ({ run })),
}))

import evoucherOrderCanceledHandler, { config } from "../evoucher-order-canceled"

// EV-16 (spec 02 กฎข้อ 32): subscriber ส่งแค่ order_id จาก data.id เข้า workflow; ล้ม → log error ไม่ retry (แบบ EV-4)
describe("evoucherOrderCanceledHandler", () => {
  const logger = { error: jest.fn() }
  const container = { resolve: jest.fn(() => logger) }
  const handle = (id: string) =>
    evoucherOrderCanceledHandler({
      event: { name: "order.canceled", data: { id } },
      container,
    } as unknown as Parameters<typeof evoucherOrderCanceledHandler>[0])

  beforeEach(() => jest.clearAllMocks())

  it("listens to order.canceled", () => {
    expect(config.event).toBe("order.canceled")
  })

  it("passes only the order id into the workflow", async () => {
    run.mockResolvedValue({ result: { released: 0 } })

    await handle("order_1")

    expect(run).toHaveBeenCalledWith({ input: { order_id: "order_1" } })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("logs the error with the order id and does not throw when the workflow fails", async () => {
    // error จาก workflow.run() ไม่ใช่ instanceof Error (เป็น object ที่มี message) — ต้องไม่ log เป็น [object Object]
    run.mockRejectedValue({ message: "Failed to acquire lock" })

    await expect(handle("order_2")).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(String(logger.error.mock.calls[0][0])).toMatch(/order_2.*Failed to acquire lock/)
    expect(String(logger.error.mock.calls[0][0])).not.toContain("[object Object]")
  })
})
