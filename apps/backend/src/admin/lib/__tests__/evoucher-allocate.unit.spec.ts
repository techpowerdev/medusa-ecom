import { allocateErrorMessage, allocateResultToast } from "../evoucher-allocate"

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

  it("asks for more codes when a line is still backordered", () => {
    expect(allocateResultToast(result({ allocated: ["li_1"], backordered: ["li_2"] }))).toEqual({
      variant: "success",
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
    expect(allocateErrorMessage(new Error(" "))).toMatch(/could not allocate/i)
  })
})
