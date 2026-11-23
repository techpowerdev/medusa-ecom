import { describe, expect, it } from "vitest"

import { pageFromSearchParam, totalPages } from "./pagination"

// CORE-78 (spec 01 กฎข้อ 136d, AC-177): helper เดียวแทน `ordersPage` (CORE-68) และ `vouchersPagination` (EV-7e) — ผลเดิมทุกกรณี
describe("pageFromSearchParam", () => {
  it("คำนวณ offset จาก ?page= ตามขนาดหน้า (orders หน้าละ 10)", () => {
    expect(pageFromSearchParam(undefined, 10)).toEqual({ page: 1, offset: 0 })
    expect(pageFromSearchParam("1", 10)).toEqual({ page: 1, offset: 0 })
    expect(pageFromSearchParam("2", 10)).toEqual({ page: 2, offset: 10 })
    expect(pageFromSearchParam("13", 10)).toEqual({ page: 13, offset: 120 })
  })

  it("คำนวณ offset จาก ?page= ตามขนาดหน้า (vouchers หน้าละ 20)", () => {
    expect(pageFromSearchParam(undefined, 20)).toEqual({ page: 1, offset: 0 })
    expect(pageFromSearchParam("2", 20)).toEqual({ page: 2, offset: 20 })
  })

  it("?page= ที่ไม่ใช่จำนวนเต็มบวก → หน้า 1", () => {
    for (const p of ["0", "-1", "abc", "1.5", "", " 2", "02", ["2", "3"]]) {
      expect(pageFromSearchParam(p, 10), JSON.stringify(p)).toEqual({ page: 1, offset: 0 })
      expect(pageFromSearchParam(p, 20), JSON.stringify(p)).toEqual({ page: 1, offset: 0 })
    }
  })
})

describe("totalPages", () => {
  it("ปัดขึ้นจาก count และอย่างน้อย 1 หน้า", () => {
    expect(totalPages(0, 10)).toBe(1)
    expect(totalPages(1, 10)).toBe(1)
    expect(totalPages(10, 10)).toBe(1)
    expect(totalPages(11, 10)).toBe(2)
    expect(totalPages(12, 10)).toBe(2)
    expect(totalPages(21, 10)).toBe(3)
    expect(totalPages(20, 20)).toBe(1)
    expect(totalPages(25, 20)).toBe(2)
  })
})
