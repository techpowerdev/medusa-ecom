import { describe, expect, it } from "vitest"

import { ORDERS_PAGE_SIZE, ordersPage, ordersTotalPages } from "./orders-pagination"

// CORE-68 (spec 01 กฎข้อ 126, AC-167): หน้า /account/orders หน้าละ 10 จาก count ของ Medusa, ?page= 1-based
describe("ordersPage", () => {
  it("หน้าละ 10 และคำนวณ offset จาก ?page=", () => {
    expect(ORDERS_PAGE_SIZE).toBe(10)
    expect(ordersPage(undefined)).toEqual({ page: 1, offset: 0 })
    expect(ordersPage("1")).toEqual({ page: 1, offset: 0 })
    expect(ordersPage("2")).toEqual({ page: 2, offset: 10 })
    expect(ordersPage("13")).toEqual({ page: 13, offset: 120 })
  })

  it("?page= ที่ไม่ใช่จำนวนเต็มบวก → หน้า 1", () => {
    for (const p of ["0", "-1", "abc", "1.5", "", " 2", "02", ["2", "3"]]) {
      expect(ordersPage(p), JSON.stringify(p)).toEqual({ page: 1, offset: 0 })
    }
  })
})

describe("ordersTotalPages", () => {
  it("ปัดขึ้นจาก count และอย่างน้อย 1 หน้า", () => {
    expect(ordersTotalPages(0)).toBe(1)
    expect(ordersTotalPages(1)).toBe(1)
    expect(ordersTotalPages(10)).toBe(1)
    expect(ordersTotalPages(11)).toBe(2)
    expect(ordersTotalPages(12)).toBe(2)
    expect(ordersTotalPages(21)).toBe(3)
  })
})
