import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  releaseAllocatedEvoucherCodes,
  restoreReleasedEvoucherCodes,
} from "../release-allocated-evoucher-codes"

// EV-16 (spec 02 กฎข้อ 32, AC-46 unit)
describe("releaseAllocatedEvoucherCodesStep", () => {
  const service = { listEvoucherCodes: jest.fn(), updateEvoucherCodes: jest.fn() }
  const container = { resolve: jest.fn(() => service) } as unknown as MedusaContainer
  const allocatedAt = new Date("2026-11-10T03:00:00.000Z")
  const original = {
    id: "evcode_1",
    order_id: "order_1",
    order_line_item_id: "ordli_1",
    customer_id: "cus_1",
    allocated_at: allocatedAt,
  }

  beforeEach(() => jest.clearAllMocks())

  it("releases only allocated codes of the order with a conditional update and keeps their original values", async () => {
    service.listEvoucherCodes.mockResolvedValue([original])
    service.updateEvoucherCodes.mockResolvedValue([{ id: "evcode_1" }])

    const response = await releaseAllocatedEvoucherCodes({ order_id: "order_1" }, { container })

    expect(service.listEvoucherCodes).toHaveBeenCalledWith(
      { order_id: "order_1", status: "allocated" },
      expect.anything()
    )
    expect(service.updateEvoucherCodes).toHaveBeenCalledWith({
      selector: { id: ["evcode_1"], order_id: "order_1", status: "allocated" },
      data: {
        status: "available",
        order_id: null,
        order_line_item_id: null,
        customer_id: null,
        allocated_at: null,
      },
    })
    expect(response.output).toEqual({ released: 1 })
    expect(response.compensateInput).toEqual([original])
  })

  it("changes nothing and returns released 0 when the order has no allocated code", async () => {
    service.listEvoucherCodes.mockResolvedValue([])

    const response = await releaseAllocatedEvoucherCodes({ order_id: "order_2" }, { container })

    expect(service.updateEvoucherCodes).not.toHaveBeenCalled()
    expect(response.output).toEqual({ released: 0 })
  })

  // กฎข้อ 32d
  it("compensation restores the original values only on rows that are still available without an order", async () => {
    const second = { ...original, id: "evcode_2", order_line_item_id: "ordli_2" }

    await restoreReleasedEvoucherCodes([original, second], { container })

    expect(service.updateEvoucherCodes.mock.calls).toEqual([
      [
        {
          selector: { id: "evcode_1", status: "available", order_id: null },
          data: {
            status: "allocated",
            order_id: "order_1",
            order_line_item_id: "ordli_1",
            customer_id: "cus_1",
            allocated_at: allocatedAt,
          },
        },
      ],
      [
        {
          selector: { id: "evcode_2", status: "available", order_id: null },
          data: {
            status: "allocated",
            order_id: "order_1",
            order_line_item_id: "ordli_2",
            customer_id: "cus_1",
            allocated_at: allocatedAt,
          },
        },
      ],
    ])
  })

  it("compensation does nothing when nothing was released", async () => {
    await restoreReleasedEvoucherCodes([], { container })
    await restoreReleasedEvoucherCodes(undefined, { container })

    expect(service.updateEvoucherCodes).not.toHaveBeenCalled()
  })
})

// กฎข้อ 32b (static): workflow ถือ lock ต่อ order ด้วย step ของ Medusa
describe("releaseEvoucherCodesForOrderWorkflow source", () => {
  const source = readFileSync(join(__dirname, "../../release-evoucher-codes-for-order.ts"), "utf8")

  it.each(["evoucherOrderLockKey(", "acquireLockStep(", "releaseLockStep("])("uses %s", (token) => {
    expect(source).toContain(token)
  })

  it("acquires the lock before releasing codes and releases it afterwards", () => {
    const acquire = source.indexOf("acquireLockStep(")
    const step = source.indexOf("releaseAllocatedEvoucherCodesStep(")
    const release = source.indexOf("releaseLockStep(")
    expect(acquire).toBeGreaterThan(-1)
    expect(acquire).toBeLessThan(step)
    expect(step).toBeLessThan(release)
  })
})
