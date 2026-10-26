import { affectedFractions, LedgerEntry, planReversals, selectMaturedEntryIds } from "../reversal"

const entry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "affcom_1",
  affiliate_id: "aff_ann",
  program_id: "affprog_p",
  order_id: "order_1",
  line_item_id: "li_1",
  amount: 100,
  currency: "thb",
  status: "pending",
  ...overrides,
})

describe("affectedFractions", () => {
  const items = [
    { id: "li_1", quantity: 2, detail: { return_received_quantity: 0 } },
    { id: "li_2", quantity: 4, detail: { return_received_quantity: 1 } },
  ]

  it("affects every line fully when the order is canceled", () => {
    expect(affectedFractions({ status: "canceled", items })).toEqual({ li_1: 1, li_2: 1 })
  })

  it("affects every line fully when refunds cover all captures (AC-5)", () => {
    const payment_collections = [
      { payments: [{ captures: [{ raw_amount: 1070 }], refunds: [{ raw_amount: 1070 }] }] },
    ]
    expect(affectedFractions({ status: "pending", items, payment_collections })).toEqual({ li_1: 1, li_2: 1 })
  })

  it("uses the received return quantity of each line otherwise (Q3)", () => {
    const payment_collections = [{ payments: [{ captures: [{ raw_amount: 1070 }], refunds: [{ raw_amount: 300 }] }] }]
    expect(affectedFractions({ status: "pending", items, payment_collections })).toEqual({ li_1: 0, li_2: 0.25 })
  })
})

describe("planReversals", () => {
  it("reverses the full entry as a negative reversed entry (AC-5)", () => {
    expect(planReversals([entry()], { li_1: 1 })).toEqual([
      {
        affiliate_id: "aff_ann",
        program_id: "affprog_p",
        order_id: "order_1",
        line_item_id: "li_1",
        amount: -100,
        currency: "thb",
      },
    ])
  })

  it("reverses entry.amount × fraction for a partial return, rounded half-up to 2 decimals (Q3)", () => {
    expect(planReversals([entry({ amount: 33.35 })], { li_1: 0.5 }).map((r) => r.amount)).toEqual([-16.68])
  })

  it("reverses approved and paid entries too", () => {
    const entries = [entry({ status: "paid" }), entry({ id: "affcom_2", line_item_id: "li_2", status: "approved" })]
    expect(planReversals(entries, { li_1: 1, li_2: 1 }).map((r) => [r.line_item_id, r.amount])).toEqual([
      ["li_1", -100],
      ["li_2", -100],
    ])
  })

  it("is idempotent: existing reversals count toward the target (redelivered/repeated events)", () => {
    const reversed = entry({ id: "affcom_r", amount: -100, status: "reversed" })
    expect(planReversals([entry(), reversed], { li_1: 1 })).toEqual([])
  })

  it("only adds the difference when a later event affects more of the line", () => {
    const reversed = entry({ id: "affcom_r", amount: -25, status: "reversed" })
    expect(planReversals([entry(), reversed], { li_1: 1 }).map((r) => r.amount)).toEqual([-75])
  })

  it("never reverses more than earned and ignores unaffected lines", () => {
    expect(planReversals([entry()], { li_1: 3 }).map((r) => r.amount)).toEqual([-100])
    expect(planReversals([entry()], { li_1: 0 })).toEqual([])
    expect(planReversals([entry()], {})).toEqual([])
  })
})

describe("selectMaturedEntryIds", () => {
  it("approves pending entries whose line net (including reversals) is positive (Q8)", () => {
    const pending = [
      entry({ id: "affcom_full" }),
      entry({ id: "affcom_part", line_item_id: "li_2" }),
      entry({ id: "affcom_none", line_item_id: "li_3" }),
    ]
    const reversals = [
      entry({ id: "r1", amount: -100, status: "reversed" }),
      entry({ id: "r2", line_item_id: "li_2", amount: -40, status: "reversed" }),
      entry({ id: "r3", order_id: "order_other", line_item_id: "li_3", amount: -100, status: "reversed" }),
    ]
    expect(selectMaturedEntryIds(pending, reversals)).toEqual(["affcom_part", "affcom_none"])
  })
})
