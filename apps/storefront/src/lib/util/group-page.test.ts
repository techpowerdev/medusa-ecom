import { describe, expect, it } from "vitest"

import { groupDiscountValue, groupProgress, groupSharePath, type PublicGroupBuyCampaign, type PublicGroupBuyGroup } from "./group-page"

const group = (over: Partial<PublicGroupBuyGroup> = {}): PublicGroupBuyGroup => ({
  id: "grp_1",
  name: null,
  join_token: "tok_1",
  status: "open",
  kind: "team",
  starts_at: null,
  ends_at: null,
  progress_orders: 4,
  progress_units: 7,
  progress_people: 2,
  ...over,
})

const campaign = (over: Partial<PublicGroupBuyCampaign> = {}): PublicGroupBuyCampaign => ({
  id: "gbc_1",
  name: "แคมเปญ",
  starts_at: null,
  ends_at: null,
  target_type: "people",
  target_value: 3,
  group_mode: "team",
  max_people_per_group: null,
  max_units_per_person: null,
  team_duration_hours: 24,
  pay_within_hours: 24,
  discount: { type: "percentage", value: 10, currency_code: null },
  product_id: "prod_1",
  ...over,
})

describe("groupProgress (GB-7a1, AC-16a)", () => {
  it("target_type=people ใช้ progress_people เทียบ target_value", () => {
    expect(groupProgress(group(), campaign())).toEqual({ current: 2, target: 3, percent: 67, unit: "คน" })
  })

  it("orders/units ใช้ progress ของชนิดนั้น", () => {
    expect(groupProgress(group(), campaign({ target_type: "orders", target_value: 5 }))).toEqual({
      current: 4,
      target: 5,
      percent: 80,
      unit: "คำสั่งซื้อ",
    })
    expect(groupProgress(group(), campaign({ target_type: "units", target_value: 10 }))).toMatchObject({
      current: 7,
      percent: 70,
      unit: "ชิ้น",
    })
  })

  it("เกินเป้าหมาย → แถบเต็ม 100% แต่ตัวเลขจริงคงเดิม", () => {
    expect(groupProgress(group({ progress_people: 5 }), campaign())).toMatchObject({ current: 5, percent: 100 })
  })

  it("target_value ≤ 0 ไม่หารด้วยศูนย์", () => {
    expect(groupProgress(group(), campaign({ target_value: 0 })).percent).toBe(100)
  })
})

describe("groupDiscountValue", () => {
  it("percentage → N%", () => {
    expect(groupDiscountValue({ type: "percentage", value: 10, currency_code: null })).toBe("10%")
  })

  it("fixed → ลดเป็นจำนวนเงินตามสกุลเงิน", () => {
    expect(groupDiscountValue({ type: "fixed", value: 100, currency_code: "thb" })).toBe("฿100")
  })

  it("ไม่มีส่วนลด → null", () => {
    expect(groupDiscountValue(null)).toBeNull()
  })
})

describe("groupSharePath", () => {
  it("ลิงก์แชร์ /g/<token> (middleware เติม country เอง — กฎข้อ 29b)", () => {
    expect(groupSharePath("ab c")).toBe("/g/ab%20c")
  })
})
