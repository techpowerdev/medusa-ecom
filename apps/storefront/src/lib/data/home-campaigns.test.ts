import { beforeEach, describe, expect, it, vi } from "vitest"

import { listActiveFlashCampaigns } from "./flash-sales"
import { createGroupBuyTeam, listActiveGroupBuyCampaigns } from "./group-buy"

// GB-7c (spec 04 กฎข้อ 29a, 29e, 29g, AC-48): data function ของส่วน `home-campaigns` บนหน้าแรก + server action สร้างทีม

const fetch = vi.fn()
let jwt: string | undefined

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "_medusa_jwt" && jwt ? { value: jwt } : undefined),
  }),
}))
vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: (...a: unknown[]) => fetch(...a) } },
}))

beforeEach(() => {
  fetch.mockReset()
  jwt = undefined
})

describe("listActiveFlashCampaigns", () => {
  it("เรียก /store/flash-sales/active โดยไม่ส่ง variant_ids และใช้ revalidate ของหน้าแรก (≤ 60)", async () => {
    fetch.mockResolvedValue({ flash_sales: [{ id: "camp_f" }], variants: [] })
    expect(await listActiveFlashCampaigns()).toEqual([{ id: "camp_f" }])
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe("/store/flash-sales/active")
    expect(opts.query).toBeUndefined()
    expect(opts.next.revalidate).toBeLessThanOrEqual(60)
  })

  it("ล้ม → []", async () => {
    fetch.mockRejectedValue(new Error("down"))
    expect(await listActiveFlashCampaigns()).toEqual([])
  })
})

describe("listActiveGroupBuyCampaigns", () => {
  it("อ่าน GB-11 แบบสาธารณะ (ไม่ส่ง token ลูกค้า) ใช้ revalidate ของหน้าแรก", async () => {
    jwt = "tok"
    fetch.mockResolvedValue({ campaigns: [{ id: "gbc_1" }] })
    expect(await listActiveGroupBuyCampaigns()).toEqual([{ id: "gbc_1" }])
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe("/store/group-buy/campaigns/active")
    expect(opts.headers?.authorization).toBeUndefined()
    expect(opts.next.revalidate).toBeLessThanOrEqual(60)
  })

  it("ล้ม → []", async () => {
    fetch.mockRejectedValue(new Error("down"))
    expect(await listActiveGroupBuyCampaigns()).toEqual([])
  })
})

describe("createGroupBuyTeam", () => {
  it("ยังไม่ login → unauthorized และไม่ยิง POST (กฎข้อ 29e)", async () => {
    expect(await createGroupBuyTeam("gbc_1")).toEqual({ error: "unauthorized" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("login แล้ว → POST /store/group-buy/groups ครั้งเดียว คืน join_token ของทีมใหม่", async () => {
    jwt = "tok"
    fetch.mockResolvedValue({ group: { id: "grp_1", join_token: "new_tok" } })
    expect(await createGroupBuyTeam("gbc_1")).toEqual({ ok: true, token: "new_tok" })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe("/store/group-buy/groups")
    expect(opts).toEqual(
      expect.objectContaining({ method: "POST", body: { campaign_id: "gbc_1" }, headers: { authorization: "Bearer tok" } })
    )
  })

  it("400 GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED → ข้อความไทย", async () => {
    jwt = "tok"
    fetch.mockRejectedValue(
      Object.assign(new Error("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED: one product"), { status: 400 })
    )
    expect(await createGroupBuyTeam("gbc_1")).toEqual({ error: "failed", message: "แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม" })
  })

  it("401 (JWT หมดอายุ) → unauthorized", async () => {
    jwt = "tok"
    fetch.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))
    expect(await createGroupBuyTeam("gbc_1")).toEqual({ error: "unauthorized" })
  })
})
