import { describe, expect, it } from "vitest"

import { cardPrice, daysUntil, earningsByStatus, estimateCommission, portalPage, portalTab } from "./affiliate-portal"

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

// AF-8b (spec 05 กฎ 33): ยอดต่อสถานะตามแถวของ `GET /affiliate/me/earnings` ทีละสถานะ — storefront ไม่หักลบ/รวมยอดเอง
describe("earningsByStatus", () => {
  const row = (status: string, amount: number, currency = "thb") => ({ status, amount, currency, count: 1 })

  it("แต่ละสถานะใช้ค่าของแถวนั้นตรงๆ — reversed ติดลบแยก ไม่หักจาก approved (AC-40)", () => {
    expect(
      earningsByStatus([row("approved", 50), row("paid", 100), row("pending", 30), row("reversed", -20)])
    ).toEqual({
      pending: [{ amount: 30, currency_code: "thb" }],
      approved: [{ amount: 50, currency_code: "thb" }],
      paid: [{ amount: 100, currency_code: "thb" }],
      reversed: [{ amount: -20, currency_code: "thb" }],
    })
  })

  it("สถานะที่ API ไม่คืนแถว → ฿0", () => {
    expect(earningsByStatus([row("approved", 50)])).toEqual({
      pending: [{ amount: 0, currency_code: "thb" }],
      approved: [{ amount: 50, currency_code: "thb" }],
      paid: [{ amount: 0, currency_code: "thb" }],
      reversed: [{ amount: 0, currency_code: "thb" }],
    })
  })

  it("หลายสกุลเงินแสดงแยกแถว ไม่รวมข้ามสกุล", () => {
    expect(earningsByStatus([row("paid", 100), row("paid", 5, "usd")]).paid).toEqual([
      { amount: 100, currency_code: "thb" },
      { amount: 5, currency_code: "usd" },
    ])
  })
})
