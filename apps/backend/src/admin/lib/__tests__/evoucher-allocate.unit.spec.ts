import { allocateErrorMessage, allocateResultToast } from "../evoucher-allocate"
import { resendErrorMessage } from "../evoucher-resend"

// EV-24 (spec 02 กฎข้อ 40): toast หลังกด Retry allocation ตาม response ของ POST /admin/evoucher/orders/:id/allocate (กฎข้อ 39)
const result = (r: Partial<Record<"allocated" | "backordered" | "stuck", string[]>>) => ({
  allocated_line_item_ids: r.allocated ?? [],
  backordered_line_item_ids: r.backordered ?? [],
  stuck_line_item_ids: r.stuck ?? [],
})

describe("allocateResultToast", () => {
  it("reports success when every line got its codes", () => {
    expect(allocateResultToast(result({ allocated: ["li_1"] }))).toEqual({
      variant: "success",
      message: "Codes allocated",
    })
  })

  // EV-26 (กฎข้อ 42a, AC-56): ยังไม่ได้ส่ง code จึงไม่ใช่ผลสำเร็จ → warning (ข้อความเดิม)
  it("warns to import more codes when a line is still backordered", () => {
    expect(allocateResultToast(result({ allocated: ["li_1"], backordered: ["li_2"] }))).toEqual({
      variant: "warning",
      message: "Still backordered — import more codes first",
    })
  })

  // review #472: code allocated แต่ยังไม่ส่ง (อีเมลล้ม) — ห้ามบอกว่า "Codes allocated" ต้องบอกให้ resend
  it("never says allocated when a line has codes that were not delivered", () => {
    const toast = allocateResultToast(result({ allocated: ["li_1"], stuck: ["li_2"] }))
    expect(toast.variant).toBe("warning")
    expect(toast.message).not.toMatch(/^Codes allocated$/)
    expect(toast.message).toMatch(/resend/i)
  })

  it("mentions both problems when lines are backordered and stuck", () => {
    const toast = allocateResultToast(result({ backordered: ["li_1"], stuck: ["li_2"] }))
    expect(toast.variant).toBe("warning")
    expect(toast.message).toMatch(/backordered/i)
    expect(toast.message).toMatch(/resend/i)
  })
})

describe("allocateErrorMessage", () => {
  it("shows the API message", () => {
    expect(allocateErrorMessage(new Error("Cannot allocate e-voucher codes for a canceled order"))).toBe(
      "Cannot allocate e-voucher codes for a canceled order"
    )
  })

  it("falls back to a generic message when the API sent none", () => {
    expect(allocateErrorMessage(new Error(" "))).toBe(
      "Could not allocate e-voucher codes. Try again or check the server logs."
    )
  })

  // EV-26 (กฎข้อ 42c, AC-56): จัดจุด/คำแนะนำด้วยตัวจัดข้อความเดียวกับ resend (`tidyStops` ของ evoucher-resend.ts)
  it.each([
    "Cannot allocate e-voucher codes (payment not captured.). Try again or check the server logs.",
    "Cannot allocate e-voucher codes: order canceled.. Try again or check the logs.",
    "Cannot allocate e-voucher codes for a canceled order",
  ])("formats %p the same way as the resend toast", (raw) => {
    expect(allocateErrorMessage(new Error(raw))).toBe(resendErrorMessage(new Error(raw)))
  })
})
