import { CODE_STATUSES } from "../evoucher-status"
import { codesListQuery, poolsListQuery } from "../evoucher-query"

// ADM-4 (spec 08 กฎ 9, AC-7): ค่าที่ DataTable ของ dashboard เขียนลง URL (`<prefix>_offset`, `<prefix>_status`)
// อ่านกลับด้วย useQueryParams เป็น string ดิบ → แปลงเป็น query ของ admin API
describe("poolsListQuery", () => {
  it("ไม่มี offset ใน URL → หน้าแรก", () => {
    expect(poolsListQuery({}, 20)).toEqual({ limit: 20, offset: 0 })
  })

  it("อ่าน offset จาก URL", () => {
    expect(poolsListQuery({ offset: "40" }, 20)).toEqual({ limit: 20, offset: 40 })
  })

  it.each(["-20", "abc", "1.5", ""])("offset %p ที่ไม่ใช่จำนวนเต็ม ≥ 0 → 0", (offset) => {
    expect(poolsListQuery({ offset }, 20)).toEqual({ limit: 20, offset: 0 })
  })
})

describe("codesListQuery", () => {
  it("ไม่มี filter → ไม่ส่ง status", () => {
    expect(codesListQuery({ offset: "50" }, 50)).toEqual({ limit: 50, offset: 50 })
  })

  it("filter radio ของ DataTable เก็บเป็น JSON string → ส่ง status", () => {
    expect(codesListQuery({ status: JSON.stringify("delivered") }, 50)).toEqual({
      limit: 50,
      offset: 0,
      status: "delivered",
    })
  })

  it("ค่าดิบที่ไม่ใช่ JSON อ่านแบบเดียวกับ DataTable ของ dashboard (ใช้ string ตรงๆ)", () => {
    expect(codesListQuery({ status: "void" }, 50)).toEqual({ limit: 50, offset: 0, status: "void" })
  })

  // review nit 2: รายการสถานะมีแหล่งเดียว (evoucher-status) — สถานะที่ filter ของตารางเสนอต้องส่งไป API ได้ทุกตัว
  it.each(CODE_STATUSES)("ทุกสถานะใน CODE_STATUSES (%p) ส่งเป็น status ได้", (status) => {
    expect(codesListQuery({ status: JSON.stringify(status) }, 50)).toEqual({ limit: 50, offset: 0, status })
  })

  it.each([JSON.stringify("bogus"), JSON.stringify(["delivered"]), "{"])(
    "status %p ที่ไม่ใช่สถานะของ code → ไม่ส่ง status",
    (status) => {
      expect(codesListQuery({ status }, 50)).toEqual({ limit: 50, offset: 0 })
    }
  )
})
