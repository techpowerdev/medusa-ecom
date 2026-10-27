import { canResendEvouchers } from "../evoucher-resend"

// EV-5b: ปุ่ม resend แสดงเฉพาะ order ที่มี code `delivered` หรือ `allocated` (ส่งอีเมลล้ม, กฎข้อ 17)
describe("canResendEvouchers", () => {
  it("is true when any code is delivered or allocated", () => {
    expect(canResendEvouchers([{ status: "void" }, { status: "delivered" }])).toBe(true)
    expect(canResendEvouchers([{ status: "allocated" }])).toBe(true)
  })

  it("is false for no codes or only available/void codes", () => {
    expect(canResendEvouchers([])).toBe(false)
    expect(canResendEvouchers([{ status: "available" }, { status: "void" }])).toBe(false)
  })
})
