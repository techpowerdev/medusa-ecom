import { describe, expect, it } from "vitest"

import { GROUP_JOIN_CODES, groupJoinErrorMessage } from "./group-join-error"
import {
  canCreateTeam,
  firstPool,
  groupDiscountedAmount,
  hasHomeCampaigns,
  poolProgress,
  teamCreateFailure,
  type ActiveGroupBuyCampaign,
} from "./home-campaigns"

const THAI = /[฀-๿]/

const campaign = (over: Partial<ActiveGroupBuyCampaign> = {}): ActiveGroupBuyCampaign => ({
  id: "gbc_1",
  name: "แคมเปญ",
  starts_at: null,
  ends_at: null,
  target_type: "orders",
  target_value: 5,
  group_mode: "both",
  max_people_per_group: null,
  max_units_per_person: null,
  team_duration_hours: 24,
  pay_within_hours: 24,
  discount: { type: "percentage", value: 10, currency_code: null },
  product_id: "prod_1",
  pool_groups: [],
  ...over,
})

describe("groupDiscountedAmount (GB-7c, AC-48)", () => {
  it("percentage: ราคาหลังส่วนลด ปัดเป็นสตางค์", () => {
    expect(groupDiscountedAmount(1000, "thb", { type: "percentage", value: 10, currency_code: null })).toBe(900)
    expect(groupDiscountedAmount(99.99, "thb", { type: "percentage", value: 15, currency_code: null })).toBe(84.99)
  })

  it("fixed: หักจำนวนเงินเมื่อสกุลตรงกัน (ไม่ต่ำกว่า 0) ไม่ใช้ float", () => {
    expect(groupDiscountedAmount(300.3, "thb", { type: "fixed", value: 100.1, currency_code: "THB" })).toBe(200.2)
    expect(groupDiscountedAmount(50, "thb", { type: "fixed", value: 80, currency_code: "thb" })).toBe(0)
  })

  it("ไม่มีส่วนลด/สกุลไม่ตรง/ค่าไม่บวก → null (การ์ดแสดงราคาปกติอย่างเดียว)", () => {
    expect(groupDiscountedAmount(1000, "thb", null)).toBeNull()
    expect(groupDiscountedAmount(1000, "thb", { type: "fixed", value: 10, currency_code: "usd" })).toBeNull()
    expect(groupDiscountedAmount(1000, "thb", { type: "percentage", value: 0, currency_code: null })).toBeNull()
  })
})

describe("canCreateTeam (กฎข้อ 29a)", () => {
  it("team/both สร้างทีมได้, pool ไม่ได้", () => {
    expect(canCreateTeam(campaign({ group_mode: "both" }))).toBe(true)
    expect(canCreateTeam(campaign({ group_mode: "team" }))).toBe(true)
    expect(canCreateTeam(campaign({ group_mode: "pool" }))).toBe(false)
  })
})

describe("poolProgress", () => {
  it("ความคืบหน้าของ pool ตาม target_type ของแคมเปญ", () => {
    const pool = {
      id: "grp_p",
      name: null,
      join_token: "tok_p",
      status: "open" as const,
      starts_at: null,
      ends_at: null,
      progress_orders: 2,
      progress_units: 3,
      progress_people: 2,
    }
    expect(poolProgress(pool, campaign())).toEqual({ current: 2, target: 5, percent: 40, unit: "คำสั่งซื้อ" })
  })
})

describe("firstPool (ลำดับคงที่ — route ไม่เรียงกลุ่ม)", () => {
  const pool = (join_token: string, ends_at: string | null) => ({
    id: `grp_${join_token}`,
    name: null,
    join_token,
    status: "open" as const,
    starts_at: null,
    ends_at,
    progress_orders: 0,
    progress_units: 0,
    progress_people: 0,
  })

  it("ไม่มี pool → null; หลาย pool → ends_at เร็วสุด, เท่ากันเรียง join_token, ไม่มี ends_at ไว้ท้าย ไม่ขึ้นกับลำดับใน array", () => {
    expect(firstPool(campaign())).toBeNull()
    const a = pool("a", "2026-11-05T00:00:00Z")
    const b = pool("b", "2026-11-05T00:00:00Z")
    const c = pool("c", "2026-11-04T00:00:00Z")
    const d = pool("d", null)
    expect(firstPool(campaign({ pool_groups: [d, b, a, c] }))?.join_token).toBe("c")
    const orders = [
      [d, b, a],
      [a, b, d],
      [b, d, a],
    ]
    // ลำดับ input ต่างกันจริง (กฎข้อ 34b)
    expect(new Set(orders.map((o) => JSON.stringify(o.map((g) => g.join_token)))).size).toBe(orders.length)
    for (const pool_groups of orders) {
      expect(firstPool(campaign({ pool_groups }))?.join_token).toBe("a")
    }
  })
})

describe("teamCreateFailure (กฎข้อ 29e, 29g — error map ของ GB-7a2a)", () => {
  it("401 → unauthorized (พาไปหน้า login)", () => {
    expect(teamCreateFailure({ status: 401, message: "Unauthorized" })).toEqual({ error: "unauthorized" })
  })

  it("400 GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED → ข้อความไทยของ code", () => {
    const err = { status: 400, message: "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED: campaign must target exactly one product" }
    const result = teamCreateFailure(err)
    expect(result).toEqual({ error: "failed", message: groupJoinErrorMessage(err) })
    expect(GROUP_JOIN_CODES).toContain("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED")
    expect("message" in result && result.message).toMatch(THAI)
  })

  it("400 not_allowed / 403 mode / 5xx → ข้อความไทย ปิดรับ ≠ ลองใหม่", () => {
    const closed = teamCreateFailure({ status: 400, message: "Campaign is not active" })
    const mode = teamCreateFailure({ status: 403, message: "Team groups are not allowed" })
    const failed = teamCreateFailure({ status: 500, message: "boom" })
    for (const r of [closed, mode, failed]) expect("message" in r && r.message).toMatch(THAI)
    expect(closed).toEqual(mode)
    expect(closed).not.toEqual(failed)
  })
})

describe("hasHomeCampaigns (AC-48: ไม่มีแคมเปญ → ไม่มี home-campaigns)", () => {
  it("ว่างทั้งสองแบบ → false; มีแบบใดแบบหนึ่ง → true", () => {
    expect(hasHomeCampaigns([], [])).toBe(false)
    expect(hasHomeCampaigns([], [campaign()])).toBe(true)
    expect(
      hasHomeCampaigns(
        [
          {
            id: "camp_f",
            name: "F",
            starts_at: null,
            ends_at: null,
            banner_text: null,
            show_countdown: true,
            show_remaining: false,
            sold_out: false,
            remaining_units: null,
          },
        ],
        []
      )
    ).toBe(true)
  })
})
