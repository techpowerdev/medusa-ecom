import {
  calculateCommission,
  CommissionLineItem,
  CommissionProgram,
  isProgramActiveAt,
} from "../commission"

const program = (overrides: Partial<CommissionProgram> = {}): CommissionProgram => ({
  commission_type: "percentage",
  commission_value: 10,
  scope: { all: true },
  cap_per_order: null,
  ...overrides,
})

const item = (overrides: Partial<CommissionLineItem> = {}): CommissionLineItem => ({
  id: "li_1",
  variant_id: "variant_1",
  product_collection_id: null,
  product_category_ids: [],
  subtotal: 1000,
  discount_subtotal: 0,
  ...overrides,
})

describe("calculateCommission", () => {
  it("pays the percentage of every line when the scope is all products (AC-1 base)", () => {
    expect(calculateCommission(program(), [item()])).toEqual([
      { line_item_id: "li_1", amount: 100 },
    ])
  })

  it("uses the paid amount after discount, excluding tax and shipping (rule 3)", () => {
    // subtotal is already excluding tax; shipping is never a line item
    const result = calculateCommission(program(), [
      item({ subtotal: 1000, discount_subtotal: 200 }),
    ])

    expect(result).toEqual([{ line_item_id: "li_1", amount: 80 }])
  })

  it("only pays lines inside the collection scope (AC-4)", () => {
    const result = calculateCommission(program({ scope: { collection_ids: ["pcol_c"] } }), [
      item({ id: "li_in", product_collection_id: "pcol_c", subtotal: 500 }),
      item({ id: "li_out", product_collection_id: "pcol_other", subtotal: 700 }),
    ])

    expect(result).toEqual([{ line_item_id: "li_in", amount: 50 }])
  })

  it("matches lines by variant or category scope", () => {
    const result = calculateCommission(
      program({ scope: { variant_ids: ["variant_a"], category_ids: ["pcat_x"] } }),
      [
        item({ id: "li_variant", variant_id: "variant_a", subtotal: 100 }),
        item({ id: "li_category", variant_id: "variant_b", product_category_ids: ["pcat_x"], subtotal: 200 }),
        item({ id: "li_none", variant_id: "variant_c", product_category_ids: ["pcat_y"], subtotal: 300 }),
      ]
    )

    expect(result).toEqual([
      { line_item_id: "li_variant", amount: 10 },
      { line_item_id: "li_category", amount: 20 },
    ])
  })

  it("pays nothing when the scope is empty", () => {
    expect(calculateCommission(program({ scope: {} }), [item()])).toEqual([])
  })

  it("enforces the cap per order across lines (rule 4)", () => {
    const result = calculateCommission(program({ cap_per_order: 150 }), [
      item({ id: "li_1", subtotal: 1000 }),
      item({ id: "li_2", subtotal: 1000 }),
      item({ id: "li_3", subtotal: 1000 }),
    ])

    expect(result).toEqual([
      { line_item_id: "li_1", amount: 100 },
      { line_item_id: "li_2", amount: 50 },
    ])
  })

  it("rounds each line to 2 decimals, half up", () => {
    const result = calculateCommission(program({ commission_value: 7.5 }), [
      item({ subtotal: 333.3 }),
    ])

    // 333.3 * 7.5% = 24.9975
    expect(result).toEqual([{ line_item_id: "li_1", amount: 25 }])
  })

  it("skips lines whose paid amount is zero", () => {
    expect(
      calculateCommission(program(), [item({ subtotal: 100, discount_subtotal: 100 })])
    ).toEqual([])
  })
})

describe("isProgramActiveAt", () => {
  const window = {
    status: "published" as const,
    starts_at: new Date("2026-11-01T00:00:00Z"),
    ends_at: new Date("2026-11-08T00:00:00Z"),
  }

  it("is active inside the window of a published program", () => {
    expect(isProgramActiveAt(window, new Date("2026-11-01T00:00:00Z"))).toBe(true)
    expect(isProgramActiveAt(window, new Date("2026-11-07T23:59:59Z"))).toBe(true)
  })

  it("is not active before start or from the end", () => {
    expect(isProgramActiveAt(window, new Date("2026-10-31T23:59:59Z"))).toBe(false)
    expect(isProgramActiveAt(window, new Date("2026-11-08T00:00:00Z"))).toBe(false)
  })

  it("is never active for draft or ended programs (rule 9)", () => {
    const at = new Date("2026-11-03T00:00:00Z")
    expect(isProgramActiveAt({ ...window, status: "draft" }, at)).toBe(false)
    expect(isProgramActiveAt({ ...window, status: "ended" }, at)).toBe(false)
  })
})
