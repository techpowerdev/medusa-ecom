import { buildPayout, PayoutCandidateEntry } from "../payout"

const entry = (overrides: Partial<PayoutCandidateEntry> = {}): PayoutCandidateEntry => ({
  id: "affcom_1",
  amount: 100,
  currency: "thb",
  status: "approved",
  ...overrides,
})

// Q8: payout = Σ approved + Σ reversed ที่ยังไม่อยู่ใน payout ใด; ยอดสุทธิ ≤ 0 → ไม่สร้าง payout
describe("buildPayout", () => {
  it("sums approved entries (AC-7)", () => {
    expect(
      buildPayout([entry(), entry({ id: "affcom_2", amount: 50.25 })])
    ).toEqual({ amount: 150.25, currency: "thb", entry_ids: ["affcom_1", "affcom_2"] })
  })

  it("nets reversed entries against approved ones", () => {
    expect(
      buildPayout([
        entry({ amount: 100 }),
        entry({ id: "affcom_2", amount: -40, status: "reversed" }),
      ])
    ).toEqual({ amount: 60, currency: "thb", entry_ids: ["affcom_1", "affcom_2"] })
  })

  it("ignores pending and paid entries", () => {
    expect(
      buildPayout([
        entry(),
        entry({ id: "affcom_2", status: "pending" }),
        entry({ id: "affcom_3", status: "paid" }),
      ])
    ).toEqual({ amount: 100, currency: "thb", entry_ids: ["affcom_1"] })
  })

  it("returns null when the net is zero or negative (carried over)", () => {
    expect(
      buildPayout([entry(), entry({ id: "affcom_2", amount: -100, status: "reversed" })])
    ).toBeNull()
    expect(buildPayout([entry({ amount: -10, status: "reversed" })])).toBeNull()
    expect(buildPayout([])).toBeNull()
  })

  it("avoids floating point drift", () => {
    expect(
      buildPayout([entry({ amount: 0.1 }), entry({ id: "affcom_2", amount: 0.2 })])?.amount
    ).toEqual(0.3)
  })

  it("rejects entries in more than one currency", () => {
    expect(() =>
      buildPayout([entry(), entry({ id: "affcom_2", currency: "usd" })])
    ).toThrow(/currency/)
  })
})
