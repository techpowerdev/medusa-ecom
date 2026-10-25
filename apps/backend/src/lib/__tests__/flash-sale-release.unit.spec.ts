import { isOrderFullyRefunded } from "../flash-sale-release"

// FS-2 (spec 03 กฎข้อ 10): refund เต็มจำนวนของ order = ยอด refund รวม >= ยอด capture รวม (> 0) ของทุก payment
// คำนวณด้วย MathBN บน raw_amount (ไม่ใช้ float)
describe("isOrderFullyRefunded", () => {
  const raw = (value: string) => ({ raw_amount: { value, precision: 20 } })
  const order = (...payments: { captures?: string[]; refunds?: string[] }[]) => ({
    payment_collections: [
      {
        payments: payments.map((p) => ({
          captures: (p.captures ?? []).map(raw),
          refunds: (p.refunds ?? []).map(raw),
        })),
      },
    ],
  })

  it("is true when every captured amount was refunded", () => {
    expect(isOrderFullyRefunded(order({ captures: ["500"], refunds: ["500"] }))).toBe(true)
  })

  it("sums several refunds and several payments", () => {
    expect(
      isOrderFullyRefunded(order({ captures: ["300"], refunds: ["100", "200"] }, { captures: ["200"], refunds: ["200"] }))
    ).toBe(true)
  })

  it("has no float rounding error: capture 300.30 = refund 100.10 + 200.20", () => {
    expect(isOrderFullyRefunded(order({ captures: ["300.30"], refunds: ["100.10", "200.20"] }))).toBe(true)
  })

  it("is false for a partial refund", () => {
    expect(isOrderFullyRefunded(order({ captures: ["500"], refunds: ["499.99"] }))).toBe(false)
    expect(isOrderFullyRefunded(order({ captures: ["300"], refunds: ["300"] }, { captures: ["200"] }))).toBe(false)
  })

  it("is false when nothing was captured", () => {
    expect(isOrderFullyRefunded(order({}))).toBe(false)
    expect(isOrderFullyRefunded({ payment_collections: [] })).toBe(false)
    expect(isOrderFullyRefunded({})).toBe(false)
  })
})
