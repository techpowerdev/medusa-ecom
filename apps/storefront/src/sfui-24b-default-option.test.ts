import { describe, expect, it, vi } from "vitest"

import { groupItems } from "@modules/store/components/store-refinements/option-refinements"

// SFUI-24b (spec 09 กฎ 87, AC-77): Medusa admin 2.22.1 สร้าง option "Default option" ค่า "Default option value"
// ให้สินค้าที่ไม่มี variant → ตัวกรองของ /store ต้องข้ามคู่นี้ (เฉพาะคู่ title + ค่า ตรงกันทั้งสอง)
vi.mock("@lib/config", () => ({ sdk: {} }))

const facet = (label: string, count = 1) => ({
  label,
  value: label,
  count,
  isRefined: false,
  highlighted: label,
})

const titles = (labels: string[]) =>
  groupItems(labels.map((label) => facet(label))).map((group) => group.title)

describe("SFUI-24b: groupItems ข้าม option ค่าเริ่มต้นของ Medusa", () => {
  it("Default option:Default option value + ขนาด:M → เหลือกลุ่มเดียว (ขนาด)", () => {
    const groups = groupItems([
      facet("Default option:Default option value", 3),
      facet("ขนาด:M", 2),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBe("ขนาด")
    expect(groups[0].values.map((v) => v.label)).toEqual(["M"])
  })

  it("option ชื่อ Default option แต่ค่าอื่น → ยังแสดงกลุ่ม Default option", () => {
    const groups = groupItems([facet("Default option:แดง")])
    expect(groups.map((g) => g.title)).toEqual(["Default option"])
    expect(groups[0].values.map((v) => v.label)).toEqual(["แดง"])
  })

  it("ค่า Default option value ใต้ title อื่น → ยังแสดง", () => {
    expect(titles(["สี:Default option value"])).toEqual(["สี"])
  })

  it("กลุ่ม Default option ที่มีทั้งคู่ default และค่าอื่น → เหลือเฉพาะค่าอื่น", () => {
    const groups = groupItems([
      facet("Default option:Default option value"),
      facet("Default option:แดง"),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].values.map((v) => v.label)).toEqual(["แดง"])
  })

  it("มีแต่คู่ default → ไม่มีกลุ่ม", () => {
    expect(titles(["Default option:Default option value"])).toEqual([])
  })
})
