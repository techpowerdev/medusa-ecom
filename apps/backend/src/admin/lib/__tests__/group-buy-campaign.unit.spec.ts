import { campaignActions, groupProgress, pageOffset } from "../group-buy-campaign"

// GB-6b (spec 04 Admin UI, AC-30/AC-31): ปุ่มที่หน้ารายละเอียดแคมเปญแสดงตามสถานะ/group_mode
describe("campaignActions", () => {
  it.each([
    ["draft", "both", { activate: true, end: false, remove: true, createPool: false }],
    ["active", "both", { activate: false, end: true, remove: false, createPool: true }],
    ["active", "pool", { activate: false, end: true, remove: false, createPool: true }],
    ["active", "team", { activate: false, end: true, remove: false, createPool: false }],
    ["ended", "pool", { activate: false, end: false, remove: false, createPool: false }],
  ] as const)("%s + %s", (status, group_mode, expected) => {
    expect(campaignActions({ status, group_mode })).toEqual(expected)
  })
})

describe("groupProgress", () => {
  const group = { progress_orders: 2, progress_units: 5, progress_people: 1 }

  it.each([
    ["orders", "2 / 3 orders"],
    ["units", "5 / 3 units"],
    ["people", "1 / 3 people"],
  ] as const)("reads progress_* of target type %s", (target_type, expected) => {
    expect(groupProgress(group, { target_type, target_value: 3 })).toBe(expected)
  })
})

// ADM-6 (spec 08 กฎ 9, review PR #293): gb_offset ใน URL แก้ด้วยมือได้ — ค่าที่ไม่ใช่จำนวนเต็มไม่ติดลบใช้ 0 (ไม่ส่งให้ backend ตอบ 400)
describe("pageOffset", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    ["abc", 0],
    ["-20", 0],
    ["20", 20],
    ["40", 40],
    ["20.5", 20],
    ["Infinity", 0],
  ] as const)("%p → %p", (input, expected) => {
    expect(pageOffset(input)).toBe(expected)
  })
})
