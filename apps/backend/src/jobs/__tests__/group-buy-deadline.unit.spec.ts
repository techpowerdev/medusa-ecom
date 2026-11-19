import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import groupBuyDeadlineJob from "../group-buy-deadline"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"

jest.mock("../../workflows/group-buy/campaign-status", () => ({ setGroupBuyCampaignStatusWorkflow: jest.fn() }))
jest.mock("../../workflows/group-buy/group-outcome", () => ({
  failGroupWorkflow: jest.fn(),
  succeedGroupWorkflow: jest.fn(),
}))
jest.mock("../../workflows/group-buy/membership-payment", () => ({
  expireGroupBuyMembershipPaymentWorkflow: jest.fn(),
}))

// GB-16 (กฎข้อ 39, AC-59): filter membership หมดเวลาต้องมี group.status = succeeded เพื่อใช้ index (status, pay_deadline_at)
describe("group-buy-deadline job — expired membership filter", () => {
  const service = {
    listAndCountGroupBuyGroups: jest.fn().mockResolvedValue([[], 0]),
    listGroupBuyGroups: jest.fn().mockResolvedValue([]),
    listAndCountGroupBuyMemberships: jest.fn().mockResolvedValue([[], 0]),
    listGroupBuyMemberships: jest.fn().mockResolvedValue([]),
    listAndCountGroupBuyCampaigns: jest.fn().mockResolvedValue([[], 0]),
  }
  const query = { graph: jest.fn().mockResolvedValue({ data: [] }) }
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
  const container = {
    resolve: (key: string) =>
      ({
        [ContainerRegistrationKeys.LOGGER]: logger,
        [ContainerRegistrationKeys.QUERY]: query,
        [GROUP_BUY_MODULE]: service,
      })[key],
  } as unknown as MedusaContainer

  it("filters by group status succeeded and pay_deadline_at <= now", async () => {
    const before = Date.now()
    await groupBuyDeadlineJob(container)

    const expected = {
      status: "awaiting_payment",
      group: { status: "succeeded", pay_deadline_at: { $lte: expect.any(Date) } },
    }
    expect(service.listAndCountGroupBuyMemberships).toHaveBeenCalledWith(expected, expect.anything())
    expect(service.listGroupBuyMemberships).toHaveBeenCalledWith(expected, expect.anything())
    const now = service.listGroupBuyMemberships.mock.calls[0][0].group.pay_deadline_at.$lte as Date
    expect(now.getTime()).toBeGreaterThanOrEqual(before)
  })
})
