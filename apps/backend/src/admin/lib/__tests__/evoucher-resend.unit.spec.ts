import { canResendEvouchers, resendErrorMessage } from "../evoucher-resend"

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

// EV-13 (AC-32): toast error ของ resend ไม่แสดง id `noti_…` — ข้อความสั้นให้ลองใหม่/ดู log
describe("resendErrorMessage", () => {
  it("drops notification ids and the Notification module prefix", () => {
    const message = resendErrorMessage(
      new Error("Could not send the e-voucher email: Failed to send notification with id noti_01K8ABCDEF: smtp down")
    )
    expect(message).toBe("Could not send the e-voucher email: smtp down. Try again or check the server logs.")
  })

  it("keeps a short backend message as is", () => {
    expect(resendErrorMessage(new Error("An e-voucher email resend for this order is already in progress"))).toBe(
      "An e-voucher email resend for this order is already in progress"
    )
  })

  it("falls back to a generic hint when there is no message", () => {
    expect(resendErrorMessage(new Error(""))).toMatch(/try again.*log/i)
  })
})
