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

// GB-32 กฎข้อ 58 (a)(b), AC-75 (a)(b): เพดานตรวจกับ provider ต่อรอบ + อ่านซ้ำ skip 0 เมื่อ skip เกินจำนวนจริง
// unit อย่างเดียว (AC-75 a ให้เลือกได้): ใช้ค่าคงที่ที่ export จริง (210 ราย) โดยไม่ต้องเพิ่มช่อง inject เพดานใน job เพื่อ test
// fake service ทำ skip/take/$nin/order แบบ DB — สิ่งที่ integration จะพิสูจน์เพิ่มคือ query ของ DB ซึ่ง test GB-16/GB-20b ครอบอยู่แล้ว
describe("group-buy-deadline job — payment check cap per tick (GB-32)", () => {
  const { MAX_PAYMENT_CHECKS_PER_TICK } = jest.requireActual("../../modules/group_buy/utils/membership-payment")
  const { checkGroupBuyMembershipPaymentWorkflow, expireGroupBuyMembershipPaymentWorkflow } = jest.requireMock(
    "../../workflows/group-buy/membership-payment"
  )
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
  const fakeService = (ids: string[], count = ids.length) => ({
    listAndCountGroupBuyGroups: jest.fn().mockResolvedValue([[], 0]),
    listGroupBuyGroups: jest.fn().mockResolvedValue([]),
    listAndCountGroupBuyMemberships: jest.fn().mockResolvedValue([[], count]),
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
  const containerWith = (service: ReturnType<typeof fakeService>) =>
    ({
      resolve: (key: string) =>
        ({
          [ContainerRegistrationKeys.LOGGER]: logger,
          [ContainerRegistrationKeys.QUERY]: { graph: jest.fn().mockResolvedValue({ data: [] }) },
          [GROUP_BUY_MODULE]: service,
        })[key],
    }) as unknown as MedusaContainer
  let checked: string[]
  let expired: string[]
  const mockDecision = (decision: string) => {
    checkGroupBuyMembershipPaymentWorkflow.mockReturnValue({
      run: async ({ input }: { input: { membership_id: string } }) => {
        checked.push(input.membership_id)
        return { result: { decision } }
      },
    })
    expireGroupBuyMembershipPaymentWorkflow.mockReturnValue({
      run: async ({ input }: { input: { membership_id: string } }) => {
        expired.push(input.membership_id)
        return { result: [] }
      },
    })
  }
  const atTick = (tick: number) => jest.useFakeTimers({ now: tick * 60_000, doNotFake: ["nextTick", "setImmediate", "queueMicrotask", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] })

  beforeEach(() => {
    jest.clearAllMocks()
    checked = []
    expired = []
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("cap = 4 × BATCH = 200 (Q26 = ก)", () => {
    expect(MAX_PAYMENT_CHECKS_PER_TICK).toEqual(4 * 50)
  })

  it("(a) cap + 10 expired memberships, provider errors for all (retry) → one tick calls the provider exactly cap times; the next tick checks the rest", async () => {
    const ids = Array.from({ length: MAX_PAYMENT_CHECKS_PER_TICK + 10 }, (_, i) => `gbmem_${String(i).padStart(3, "0")}`)
    mockDecision("retry")
    const service = fakeService(ids)

    atTick(0)
    await groupBuyDeadlineJob(containerWith(service))
    expect(checked).toHaveLength(MAX_PAYMENT_CHECKS_PER_TICK)
    expect(new Set(checked).size).toEqual(MAX_PAYMENT_CHECKS_PER_TICK)
    const nin = service.listGroupBuyMemberships.mock.calls.map(([f]: any[]) => f.id?.$nin?.length ?? 0)
    expect(Math.max(...nin)).toBeLessThanOrEqual(MAX_PAYMENT_CHECKS_PER_TICK)
    const rest = ids.filter((id) => !checked.includes(id))
    expect(rest).toHaveLength(10)

    checked = []
    atTick(1)
    await groupBuyDeadlineJob(containerWith(service))
    expect(checked).toHaveLength(MAX_PAYMENT_CHECKS_PER_TICK)
    expect(checked.slice(0, rest.length).sort()).toEqual(rest)
    expect(expired).toEqual([])
  })

  it("(b) count says 60 but the list at the rotated skip is empty (rows changed in between) → re-read with skip 0 and process", async () => {
    const ids = ["gbmem_a", "gbmem_b", "gbmem_c"]
    mockDecision("unpaid")
    const service = fakeService(ids, 60)

    atTick(1)
    await groupBuyDeadlineJob(containerWith(service))

    expect(service.listGroupBuyMemberships.mock.calls[0][1].skip).toBeGreaterThan(0)
    expect(service.listGroupBuyMemberships).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: 0 }))
    expect(expired.sort()).toEqual(ids)
  })
})
