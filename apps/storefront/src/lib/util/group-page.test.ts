import { describe, expect, it } from "vitest"

import {
  addToSelection,
  groupDiscountValue,
  groupJoinable,
  groupProgress,
  groupSharePath,
  removeFromSelection,
  selectionUnits,
  setSelectionQuantity,
  type PublicGroupBuyCampaign,
  type PublicGroupBuyGroup,
} from "./group-page"

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

// GB-7a2 (กฎข้อ 29e): ปุ่ม join และลิงก์แชร์ใช้เงื่อนไขเดียวกัน — status open และยังไม่เลย ends_at
describe("groupJoinable", () => {
  const now = Date.parse("2026-11-04T10:00:00Z")
  it("open + ends_at ในอนาคต → true", () => {
    expect(groupJoinable(group({ ends_at: "2026-11-04T10:00:01Z" }), now)).toBe(true)
  })
  it("ends_at <= now แม้ status ยัง open → false", () => {
    expect(groupJoinable(group({ ends_at: "2026-11-04T10:00:00Z" }), now)).toBe(false)
    expect(groupJoinable(group({ ends_at: "2026-11-04T09:00:00Z" }), now)).toBe(false)
  })
  it("ไม่ open หรือไม่มี ends_at → false", () => {
    expect(groupJoinable(group({ status: "succeeded", ends_at: "2026-11-05T00:00:00Z" }), now)).toBe(false)
    expect(groupJoinable(group({ ends_at: null }), now)).toBe(false)
  })
})

// GB-7a2 (กฎข้อ 31a–c): รายการ group-selection เป็น state ในหน้า
describe("รายการ group-selection", () => {
  it("variant เดิมซ้ำ = รวมจำนวน; variant ใหม่ต่อท้าย", () => {
    let list = addToSelection([], "v1", 2)
    list = addToSelection(list, "v2", 1)
    list = addToSelection(list, "v1", 1)
    expect(list).toEqual([
      { variant_id: "v1", quantity: 3 },
      { variant_id: "v2", quantity: 1 },
    ])
    expect(selectionUnits(list)).toBe(4)
  })

  it("แก้จำนวน (clamp 1..100) และลบรายการ", () => {
    const list = [
      { variant_id: "v1", quantity: 2 },
      { variant_id: "v2", quantity: 1 },
    ]
    expect(setSelectionQuantity(list, "v1", "5")).toEqual([
      { variant_id: "v1", quantity: 5 },
      { variant_id: "v2", quantity: 1 },
    ])
    expect(setSelectionQuantity(list, "v2", "0")[1].quantity).toBe(1)
    expect(setSelectionQuantity(list, "v2", "500")[1].quantity).toBe(100)
    expect(removeFromSelection(list, "v1")).toEqual([{ variant_id: "v2", quantity: 1 }])
    expect(addToSelection([{ variant_id: "v1", quantity: 99 }], "v1", 5)).toEqual([{ variant_id: "v1", quantity: 100 }])
  })
})
