import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// GB-7b (spec 04 กฎข้อ 13, ADR-016): server action ของหน้า account — อ่าน membership จาก GB-8 และออกจากกลุ่ม
const fetchMock = vi.fn()

vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchMock(...a) } } }))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: async () => ({ authorization: "Bearer t" }) }))

const THAI = /[฀-๿]/

describe("listGroupBuyMemberships", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("ยิง GB-8 ด้วย token ของลูกค้า ไม่ cache และส่ง limit", async () => {
    fetchMock.mockResolvedValue({ memberships: [], count: 0 })
    const { listGroupBuyMemberships } = await import("@lib/data/group-buy")
    const { GROUP_BUY_MEMBERSHIPS_LIMIT } = await import("@lib/util/group-buy-orders")
    await expect(listGroupBuyMemberships()).resolves.toEqual({ memberships: [], count: 0 })
    expect(fetchMock).toHaveBeenCalledWith("/store/customers/me/group-buy/memberships", {
      method: "GET",
      query: { limit: GROUP_BUY_MEMBERSHIPS_LIMIT },
      headers: { authorization: "Bearer t" },
      cache: "no-store",
    })
  })

  it("อ่านล้ม → null (ไม่ทำให้หน้า orders ล่ม)", async () => {
    fetchMock.mockImplementation(async () => {
      throw new FetchError("boom", "Internal Server Error", 500)
    })
    const { listGroupBuyMemberships } = await import("@lib/data/group-buy")
    await expect(listGroupBuyMemberships()).resolves.toBeNull()
  })
})

describe("leaveGroupBuyMembership", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("สำเร็จ → POST leave ของ membership นั้น และ error = null", async () => {
    fetchMock.mockResolvedValue({ membership: { id: "gbmem_1", status: "cancelled" } })
    const { leaveGroupBuyMembership } = await import("@lib/data/group-buy")
    await expect(leaveGroupBuyMembership("gbmem_1")).resolves.toEqual({ error: null })
    expect(fetchMock).toHaveBeenCalledWith("/store/group-buy/memberships/gbmem_1/leave", {
      method: "POST",
      headers: { authorization: "Bearer t" },
      cache: "no-store",
    })
  })

  it.each([
    [400, "LEAVE_NOT_ALLOWED_MESSAGE"],
    [401, "SIGN_IN_AGAIN_MESSAGE"],
    [404, "GENERIC_ERROR_MESSAGE"],
    [500, "GENERIC_ERROR_MESSAGE"],
  ] as const)("%i → ข้อความไทย (%s) ไม่ throw", async (status, key) => {
    fetchMock.mockImplementation(async () => {
      throw new FetchError("Group is not open", "x", status)
    })
    const { leaveGroupBuyMembership } = await import("@lib/data/group-buy")
    const { LEAVE_NOT_ALLOWED_MESSAGE } = await import("@lib/util/group-buy-orders")
    const messages = await import("@lib/util/error-message")
    const expected = key === "LEAVE_NOT_ALLOWED_MESSAGE" ? LEAVE_NOT_ALLOWED_MESSAGE : messages[key]
    const { error } = await leaveGroupBuyMembership("gbmem_1")
    expect(error).toBe(expected)
    expect(error).toMatch(THAI)
  })
})
