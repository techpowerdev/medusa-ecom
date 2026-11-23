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
  checkGroupBuyMembershipPaymentWorkflow: jest.fn(),
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

// GB-28 กฎข้อ 53 (b)(e), AC-71 (b)(e): log แยก check/expire และ membership ผล retry/skip ไม่กิน slot ของ batch
describe("group-buy-deadline job — expired membership payment check", () => {
  const BATCH = 50
  const { checkGroupBuyMembershipPaymentWorkflow, expireGroupBuyMembershipPaymentWorkflow } = jest.requireMock(
    "../../workflows/group-buy/membership-payment"
  )
  // ลำดับ joined_at ASC; รองรับ filter id.$nin + skip/take แบบ DB
  const fakeService = (ids: string[]) => ({
    listAndCountGroupBuyGroups: jest.fn().mockResolvedValue([[], 0]),
    listGroupBuyGroups: jest.fn().mockResolvedValue([]),
    listAndCountGroupBuyMemberships: jest.fn().mockResolvedValue([[], ids.length]),
    listGroupBuyMemberships: jest.fn(async (filters: any, config: { skip?: number; take?: number }) => {
      const excluded: string[] = filters.id?.$nin ?? []
      const skip = config.skip ?? 0
      return ids
        .filter((id) => !excluded.includes(id))
        .slice(skip, skip + (config.take ?? ids.length))
        .map((id) => ({ id }))
    }),
    listAndCountGroupBuyCampaigns: jest.fn().mockResolvedValue([[], 0]),
  })
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
  const containerWith = (service: ReturnType<typeof fakeService>) =>
    ({
      resolve: (key: string) =>
        ({
          [ContainerRegistrationKeys.LOGGER]: logger,
          [ContainerRegistrationKeys.QUERY]: { graph: jest.fn().mockResolvedValue({ data: [] }) },
          [GROUP_BUY_MODULE]: service,
        })[key],
    }) as unknown as MedusaContainer
  let expired: string[]
  const mockWorkflows = (check: (id: string) => Promise<{ result: { decision: string } }>) => {
    checkGroupBuyMembershipPaymentWorkflow.mockReturnValue({
      run: ({ input }: { input: { membership_id: string } }) => check(input.membership_id),
    })
    expireGroupBuyMembershipPaymentWorkflow.mockReturnValue({
      run: async ({ input }: { input: { membership_id: string } }) => {
        expired.push(input.membership_id)
        return { result: [] }
      },
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    expired = []
  })

  it("logs a failed check as a check failure, not 'failed to expire membership', and does not expire it", async () => {
    mockWorkflows(async () => {
      throw new Error("check boom")
    })

    await groupBuyDeadlineJob(containerWith(fakeService(["gbmem_1"])))

    const lines = logger.error.mock.calls.map(([m]) => String(m))
    expect(lines.some((m) => m.includes("failed to expire membership"))).toBe(false)
    expect(lines).toEqual([expect.stringMatching(/failed to check payment of membership gbmem_1: check boom/)])
    expect(expired).toEqual([])
  })

  it("still logs 'failed to expire membership' when the expire workflow fails", async () => {
    mockWorkflows(async () => ({ result: { decision: "unpaid" } }))
    expireGroupBuyMembershipPaymentWorkflow.mockReturnValue({
      run: async () => {
        throw new Error("expire boom")
      },
    })

    await groupBuyDeadlineJob(containerWith(fakeService(["gbmem_1"])))

    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/failed to expire membership gbmem_1: expire boom/))
  })

  it.each(["retry", "skip"])(
    "a %s membership does not take a batch slot: batch size N + 1 such + N decidable → N expired in one run",
    async (decision) => {
      const ids = ["gbmem_x", ...Array.from({ length: BATCH }, (_, i) => `gbmem_${i}`)]
      mockWorkflows(async (id) => ({ result: { decision: id === "gbmem_x" ? decision : "unpaid" } }))

      await groupBuyDeadlineJob(containerWith(fakeService(ids)))

      expect(new Set(expired).size).toEqual(BATCH)
      expect(expired).not.toContain("gbmem_x")
    }
  )

  it("stops after N decided memberships (paid/unpaid/give_up count, checks that throw count too)", async () => {
    const ids = Array.from({ length: BATCH + 5 }, (_, i) => `gbmem_${i}`)
    const decisions = ["paid", "unpaid", "give_up", "throw"]
    let checked = 0
    mockWorkflows(async (id) => {
      checked++
      const decision = decisions[Number(id.split("_")[1]) % decisions.length]
      if (decision === "throw") {
        throw new Error("boom")
      }
      return { result: { decision } }
    })

    await groupBuyDeadlineJob(containerWith(fakeService(ids)))

    expect(checked).toEqual(BATCH)
  })
})
