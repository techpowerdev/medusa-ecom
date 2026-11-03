import { resendFailureMessage } from "../resend-evoucher-email"

// EV-N3 (กฎข้อ 30a, AC-44): ข้อความ error ของ resend ไม่มีจุดซ้อน ไม่มีวงเล็บว่าง และไม่มี id ของ notification
describe("resendFailureMessage", () => {
  it("strips trailing punctuation of the cause before wrapping it in parentheses", () => {
    const message = resendFailureMessage("Template evoucher-delivered could not be resolved.")

    expect(message).toContain("(Template evoucher-delivered could not be resolved).")
    expect(message).not.toContain(".).")
    expect(message).not.toContain("..")
  })

  it.each(["。", " ", ". ", "..."])("strips trailing %j as well", (suffix) => {
    const message = resendFailureMessage(`Template evoucher-delivered could not be resolved${suffix}`)

    expect(message).toContain("(Template evoucher-delivered could not be resolved).")
    expect(message).not.toMatch(/\.\)\.|\.\.|。\)/)
  })

  it.each(["", "   ", "."])("has no empty parentheses when the cause is %j", (cause) => {
    const message = resendFailureMessage(cause)

    expect(message).not.toContain("(")
    expect(message).toBe("Could not send the e-voucher email. Try again or check the server logs.")
  })

  it("removes the notification id from the cause (AC-32)", () => {
    const message = resendFailureMessage(
      "Failed to send notification with id noti_01ABCdef: Template evoucher-delivered could not be resolved."
    )

    expect(message).not.toContain("noti_")
    expect(message).toContain("(Template evoucher-delivered could not be resolved).")
    expect(message).not.toContain("..")
  })
})
