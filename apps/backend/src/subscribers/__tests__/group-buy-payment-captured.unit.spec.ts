const run = jest.fn()

jest.mock("../../workflows/group-buy/membership-payment", () => ({
  ...jest.requireActual("../../workflows/group-buy/membership-payment"),
  confirmGroupBuyMembershipPaymentWorkflow: jest.fn(() => ({ run })),
}))

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import groupBuyPaymentCapturedHandler from "../group-buy-payment-captured"

// GB-10 กฎข้อ 25 (e) (AC-44 รอบ 13): อ่านสถานะใหม่ก่อนส่ง alert ล้ม → fail-open ส่ง alert ต่อ + log warn
describe("groupBuyPaymentCapturedHandler — re-read fails", () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const createNotifications = jest.fn()
  const graph = jest.fn()
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [ContainerRegistrationKeys.QUERY]: { graph },
    [GROUP_BUY_MODULE]: { listGroupBuyMemberships: jest.fn().mockResolvedValue([{ id: "gbmem_1" }]) },
    [Modules.NOTIFICATION]: { createNotifications },
  }
  const container = { resolve: (key: string) => services[key] }
  const handle = () =>
    groupBuyPaymentCapturedHandler({
      event: { name: "payment.captured", data: { id: "pay_1" } },
      container,
    } as unknown as Parameters<typeof groupBuyPaymentCapturedHandler>[0])
  const saved = process.env.OPS_ALERT_EMAIL

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPS_ALERT_EMAIL = "ops@example.com"
    graph.mockImplementation(async ({ entity }: { entity: string }) => {
      if (entity === "payment") {
        return { data: [{ id: "pay_1", amount: 700, payment_collection: { order: { id: "order_1" } } }] }
      }
      throw new Error("query.graph down")
    })
  })

  afterAll(() => {
    if (saved === undefined) {
      delete process.env.OPS_ALERT_EMAIL
    } else {
      process.env.OPS_ALERT_EMAIL = saved
    }
  })

  it.each([
    ["convert_failed", { result: { action: "mark_paid" }, errors: [{ error: { message: "Not enough stock" } }] }],
    ["membership_cancelled", { result: { action: "orphan", membership_status: "cancelled" }, errors: [] }],
  ])("%s: still sends one alert with key <membership_id>:<reason> and logs a warning", async (reason, outcome) => {
    run.mockResolvedValue(outcome)

    await expect(handle()).resolves.toBeUndefined()

    expect(createNotifications).toHaveBeenCalledTimes(1)
    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.com",
        idempotency_key: `gbmem_1:${reason}`,
        data: expect.objectContaining({ reason, membership_id: "gbmem_1", order_id: "order_1" }),
      })
    )
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("query.graph down"))
  })
})
