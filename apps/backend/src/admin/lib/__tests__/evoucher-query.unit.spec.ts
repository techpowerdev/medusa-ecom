import { CODE_STATUSES } from "../evoucher-status"
import { codesListQuery } from "../evoucher-query"

// ADM-4 (spec 08 กฎ 9, AC-7): ค่า filter ที่ DataTable ของ dashboard เขียนลง URL (`<prefix>_status`)
// อ่านกลับด้วย useQueryParams เป็น string ดิบ → แปลงเป็น query ของ admin API (offset ผ่าน usePageOffset แล้ว — ADM-10)
describe("codesListQuery", () => {
  it("ไม่มี filter → ไม่ส่ง status", () => {
    expect(codesListQuery(undefined, 50, 50)).toEqual({ limit: 50, offset: 50 })
  })

  it("filter radio ของ DataTable เก็บเป็น JSON string → ส่ง status", () => {
    expect(codesListQuery(JSON.stringify("delivered"), 0, 50)).toEqual({
      limit: 50,
      offset: 0,
      status: "delivered",
    })
  })

  it("ค่าดิบที่ไม่ใช่ JSON อ่านแบบเดียวกับ DataTable ของ dashboard (ใช้ string ตรงๆ)", () => {
    expect(codesListQuery("void", 0, 50)).toEqual({ limit: 50, offset: 0, status: "void" })
  })

  // review nit 2: รายการสถานะมีแหล่งเดียว (evoucher-status) — สถานะที่ filter ของตารางเสนอต้องส่งไป API ได้ทุกตัว
  it.each(CODE_STATUSES)("ทุกสถานะใน CODE_STATUSES (%p) ส่งเป็น status ได้", (status) => {
    expect(codesListQuery(JSON.stringify(status), 0, 50)).toEqual({ limit: 50, offset: 0, status })
  })

  it.each([JSON.stringify("bogus"), JSON.stringify(["delivered"]), "{"])(
    "status %p ที่ไม่ใช่สถานะของ code → ไม่ส่ง status",
    (status) => {
      expect(codesListQuery(status, 0, 50)).toEqual({ limit: 50, offset: 0 })
    }
  )
})
