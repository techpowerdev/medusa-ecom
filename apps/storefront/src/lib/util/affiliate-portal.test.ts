import { describe, expect, it } from "vitest"

import { cardPrice, daysUntil, estimateCommission, portalPage, portalTab } from "./affiliate-portal"

// AF-8a (spec 05 กฎ 29d): ยอดประมาณการบนการ์ด = ราคาปัจจุบัน × อัตรา ปัด 2 ตำแหน่ง half-up (กฎ 11) ไม่รวม cap
describe("estimateCommission", () => {
  it.each([
    [990, 15, 148.5],
    [590, 10, 59],
    [0.1, 5, 0.01], // 0.005 → half-up 0.01
    [333.33, 12.5, 41.67], // 41.66625 → 41.67
    [100.1, 3, 3], // 3.003 → 3.00
    [1.15, 50, 0.58], // 0.575 → 0.58 (float ปกติให้ 0.57)
  ])("ราคา %s × อัตรา %s = %s", (price, rate, expected) => {
    expect(estimateCommission(price, rate)).toBe(expected)
  })
})

describe("cardPrice", () => {
  const v = (amount: number | null, currency_code = "thb") => ({
    calculated_price: { calculated_amount: amount, currency_code },
  })

  it("ราคาต่ำสุดของ variant ที่อยู่ในโปรแกรม", () => {
    expect(cardPrice([v(990), v(590), v(null)])).toEqual({ amount: 590, currency_code: "thb" })
  })

  it("ไม่มีราคา → null", () => {
    expect(cardPrice([v(null), { calculated_price: null }])).toBeNull()
    expect(cardPrice([])).toBeNull()
  })
})

describe("daysUntil", () => {
  const now = new Date("2026-10-27T10:00:00Z")

  it.each([
    ["2026-10-28T10:00:00Z", 1],
    ["2026-10-28T09:00:00Z", 1], // เหลือไม่ถึงวัน → 1 วัน
    ["2026-10-29T10:00:01Z", 3],
    ["2026-10-27T09:00:00Z", 0],
  ])("%s → %s วัน", (startsAt, days) => {
    expect(daysUntil(startsAt, now)).toBe(days)
  })
})

describe("portalTab", () => {
  it.each([
    ["upcoming", "upcoming"],
    ["active", "active"],
    [undefined, "active"],
    ["x", "active"],
    [["upcoming", "active"], "active"],
  ] as const)("%j → %s", (value, tab) => {
    expect(portalTab(value as string | string[] | undefined)).toBe(tab)
  })
})

// qa #135 D2: `?page=1.5` เคยส่ง 1.5 ไป API (page ต้องเป็น int) → 500
describe("portalPage", () => {
  it.each([
    [undefined, 1],
    ["abc", 1],
    ["0", 1],
    ["-3", 1],
    ["1.5", 1],
    ["2.9", 2],
    ["3", 3],
    ["1e400", 1],
    ["1e20", 1],
    [["2", "3"], 1],
  ] as const)("%j → %s", (value, page) => {
    expect(portalPage(value as string | string[] | undefined)).toBe(page)
  })
})
