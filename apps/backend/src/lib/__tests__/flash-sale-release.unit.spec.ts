import { isOrderFullyRefunded } from "../flash-sale-release"

// FS-2 (spec 03 กฎข้อ 10): refund เต็มจำนวนของ order = ยอด refund รวม >= ยอด capture รวม (> 0) ของทุก payment
describe("isOrderFullyRefunded", () => {
  const order = (...payments: { captures?: number[]; refunds?: number[] }[]) => ({
    payment_collections: [
      {
        payments: payments.map((p) => ({
          captures: (p.captures ?? []).map((amount) => ({ amount })),
          refunds: (p.refunds ?? []).map((amount) => ({ amount })),
        })),
      },
    ],
  })

  it("is true when every captured amount was refunded", () => {
    expect(isOrderFullyRefunded(order({ captures: [500], refunds: [500] }))).toBe(true)
  })

  it("sums several refunds and several payments", () => {
    expect(
      isOrderFullyRefunded(order({ captures: [300], refunds: [100, 200] }, { captures: [200], refunds: [200] }))
    ).toBe(true)
  })

  it("is false for a partial refund", () => {
    expect(isOrderFullyRefunded(order({ captures: [500], refunds: [499] }))).toBe(false)
    expect(isOrderFullyRefunded(order({ captures: [300], refunds: [300] }, { captures: [200] }))).toBe(false)
  })

  it("is false when nothing was captured", () => {
    expect(isOrderFullyRefunded(order({}))).toBe(false)
    expect(isOrderFullyRefunded({ payment_collections: [] })).toBe(false)
    expect(isOrderFullyRefunded({})).toBe(false)
  })

  it("accepts BigNumber-like amounts", () => {
    expect(
      isOrderFullyRefunded({
        payment_collections: [
          { payments: [{ captures: [{ amount: { numeric: 500 } }], refunds: [{ amount: "500" }] }] },
        ],
      })
    ).toBe(true)
  })
})
