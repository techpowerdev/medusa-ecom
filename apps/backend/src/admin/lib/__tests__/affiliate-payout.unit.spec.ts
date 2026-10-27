import { canCancelPayout } from "../affiliate-payout"

// AF-6 (spec 05 AC-26): ปุ่มยกเลิกเฉพาะ payout `draft`
describe("canCancelPayout", () => {
  it("is true only for draft payouts", () => {
    expect(canCancelPayout({ status: "draft" })).toBe(true)
    expect(canCancelPayout({ status: "paid" })).toBe(false)
  })
})
