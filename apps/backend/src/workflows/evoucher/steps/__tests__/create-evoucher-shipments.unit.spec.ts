const run = jest.fn()

jest.mock("@medusajs/medusa/core-flows", () => ({
  createOrderShipmentWorkflow: jest.fn(() => ({ run })),
}))

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createEvoucherShipments } from "../create-evoucher-shipments"

// EV-17 (spec 02 กฎข้อ 33c–e): อีเมล code สำเร็จ → shipment แบบ no_notification ของ fulfillment ที่มี line ของ code ชุดนั้น
describe("createEvoucherShipments", () => {
  const query = { graph: jest.fn() }
  const logger = { error: jest.fn() }
  const container = {
    resolve: jest.fn((key: string) => (key === ContainerRegistrationKeys.QUERY ? query : logger)),
  } as unknown as MedusaContainer

  const fulfillment = (id: string, lineItemIds: string[], extra: Record<string, unknown> = {}) => ({
    id,
    shipped_at: null,
    canceled_at: null,
    items: lineItemIds.map((line_item_id) => ({ line_item_id, quantity: 2 })),
    ...extra,
  })
  const givenFulfillments = (fulfillments: unknown[]) =>
    query.graph.mockResolvedValue({ data: [{ id: "order_1", fulfillments }] })

  beforeEach(() => {
    jest.clearAllMocks()
    run.mockResolvedValue({ result: undefined })
  })

  it("creates nothing when the email was not sent (กฎข้อ 33e)", async () => {
    const response = await createEvoucherShipments(
      { order_id: "order_1", line_item_ids: ["ordli_1"], sent: false },
      { container }
    )

    expect(query.graph).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
    expect(response.output).toEqual({ shipped: [] })
  })

  it("ships only open fulfillments that hold a line of the delivered codes, without a shipping notification", async () => {
    givenFulfillments([
      fulfillment("ful_open", ["ordli_1"]),
      fulfillment("ful_shipped", ["ordli_1"], { shipped_at: new Date() }),
      fulfillment("ful_canceled", ["ordli_1"], { canceled_at: new Date() }),
      fulfillment("ful_other", ["ordli_9"]),
      null,
    ])

    const response = await createEvoucherShipments(
      { order_id: "order_1", line_item_ids: ["ordli_1"], sent: true },
      { container }
    )

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({
      input: {
        order_id: "order_1",
        fulfillment_id: "ful_open",
        items: [{ id: "ordli_1", quantity: 2 }],
        no_notification: true,
      },
    })
    expect(response.output).toEqual({ shipped: ["ful_open"] })
  })

  it("is idempotent: an already shipped fulfillment is skipped", async () => {
    givenFulfillments([fulfillment("ful_1", ["ordli_1"], { shipped_at: new Date() })])

    const response = await createEvoucherShipments(
      { order_id: "order_1", line_item_ids: ["ordli_1"], sent: true },
      { container }
    )

    expect(run).not.toHaveBeenCalled()
    expect(response.output).toEqual({ shipped: [] })
  })

  // กฎข้อ 33d: ห้าม throw — ล้มแล้ว log error (error จาก workflow.run() ไม่ใช่ instanceof Error)
  it("logs a readable error and does not throw when creating a shipment fails", async () => {
    givenFulfillments([fulfillment("ful_1", ["ordli_1"]), fulfillment("ful_2", ["ordli_2"])])
    run.mockRejectedValueOnce({ message: "Shipment\n  has already been created" })

    const response = await createEvoucherShipments(
      { order_id: "order_1", line_item_ids: ["ordli_1", "ordli_2"], sent: true },
      { container }
    )

    expect(run).toHaveBeenCalledTimes(2)
    expect(response.output).toEqual({ shipped: ["ful_2"] })
    expect(logger.error).toHaveBeenCalledTimes(1)
    const line = String(logger.error.mock.calls[0][0])
    expect(line).toMatch(/^evoucher: .*ful_1.*order_1.*Shipment has already been created/)
    expect(line).not.toContain("[object Object]")
  })

  it("logs and does not throw when reading the fulfillments fails", async () => {
    query.graph.mockRejectedValue({ message: "db down" })

    const response = await createEvoucherShipments(
      { order_id: "order_1", line_item_ids: ["ordli_1"], sent: true },
      { container }
    )

    expect(run).not.toHaveBeenCalled()
    expect(response.output).toEqual({ shipped: [] })
    expect(String(logger.error.mock.calls[0][0])).toMatch(/order_1.*db down/)
  })
})
