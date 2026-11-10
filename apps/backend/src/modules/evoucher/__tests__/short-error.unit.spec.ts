import { shortError } from "../utils/short-error"

// ข้อความ error ใน log/อีเมล admin ของ e-voucher (ใช้ใน step ส่งอีเมล, resend, shipment และ subscriber order.canceled)
describe("shortError", () => {
  it("uses the message of an Error", () => {
    expect(shortError(new Error("smtp down"))).toBe("smtp down")
  })

  it("uses the message of a non-Error object thrown by workflow.run()", () => {
    expect(shortError({ message: "Failed to acquire lock" })).toBe("Failed to acquire lock")
  })

  it("collapses whitespace and cuts at 200 characters", () => {
    expect(shortError({ message: "  a\n   b  " })).toBe("a b")
    expect(shortError(new Error("x".repeat(300)))).toHaveLength(200)
  })

  it("stringifies values without a message", () => {
    expect(shortError("boom")).toBe("boom")
    expect(shortError(undefined)).toBe("undefined")
  })
})
