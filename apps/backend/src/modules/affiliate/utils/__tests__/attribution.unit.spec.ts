import { AttributionProgram, planAttribution, PlanAttributionInput } from "../attribution"

const DAY = 24 * 60 * 60 * 1000
const placedAt = new Date("2026-10-20T10:00:00.000Z")

const program = (overrides: Partial<AttributionProgram> = {}): AttributionProgram => ({
  id: "affprog_p",
  status: "published",
  starts_at: new Date(placedAt.getTime() - DAY),
  ends_at: new Date(placedAt.getTime() + DAY),
  commission_type: "percentage",
  commission_value: 10,
  scope: { all: true },
  cap_per_order: null,
  attribution_window_days: 7,
  hold_days: 14,
  ...overrides,
})

const input = (overrides: Partial<PlanAttributionInput> = {}): PlanAttributionInput => ({
  click: { affiliate_id: "aff_ann", clicked_at: new Date(placedAt.getTime() - DAY) },
  affiliate: { id: "aff_ann", email: "ann@example.com", status: "active" },
  order: { email: "buyer@example.com", placed_at: placedAt },
  programs: [program()],
  items: [{ id: "li_1", variant_id: "variant_1", subtotal: 1000, discount_subtotal: 0 }],
  ...overrides,
})

describe("planAttribution", () => {
  it("creates a pending entry of 10% for an active program (AC-1)", () => {
    expect(planAttribution(input())).toEqual({
      affiliate_id: "aff_ann",
      program_id: "affprog_p",
      entries: [{ program_id: "affprog_p", line_item_id: "li_1", amount: 100, hold_days: 14 }],
    })
  })

  it("records the attribution without a program or entry when no program is active (AC-2)", () => {
    expect(planAttribution(input({ programs: [] }))).toEqual({
      affiliate_id: "aff_ann",
      program_id: null,
      entries: [],
    })
  })

  it("does not attribute a click older than the attribution window (AC-3)", () => {
    const clicked_at = new Date(placedAt.getTime() - 10 * DAY)
    expect(planAttribution(input({ click: { affiliate_id: "aff_ann", clicked_at } }))).toBeNull()
  })

  it("attributes a click exactly at the window edge (now - clicked_at <= window)", () => {
    const clicked_at = new Date(placedAt.getTime() - 7 * DAY)
    expect(planAttribution(input({ click: { affiliate_id: "aff_ann", clicked_at } }))?.entries).toHaveLength(1)
  })

  it("rejects a token older than the 30-day cookie even without an active program", () => {
    const clicked_at = new Date(placedAt.getTime() - 31 * DAY)
    expect(planAttribution(input({ programs: [], click: { affiliate_id: "aff_ann", clicked_at } }))).toBeNull()
  })

  it("rejects a click time after the order time", () => {
    const clicked_at = new Date(placedAt.getTime() + 1000)
    expect(planAttribution(input({ click: { affiliate_id: "aff_ann", clicked_at } }))).toBeNull()
  })

  it.each(["pending", "suspended"] as const)("does not attribute when the affiliate is %s (rule 7)", (status) => {
    expect(
      planAttribution(input({ affiliate: { id: "aff_ann", email: "ann@example.com", status } }))
    ).toBeNull()
  })

  it("only pays lines in the collection scope (AC-4)", () => {
    const plan = planAttribution(
      input({
        programs: [program({ scope: { collection_ids: ["pcol_c"] } })],
        items: [
          { id: "li_in", product_collection_id: "pcol_c", subtotal: 500 },
          { id: "li_out", product_collection_id: "pcol_x", subtotal: 1000 },
        ],
      })
    )
    expect(plan?.entries).toEqual([{ program_id: "affprog_p", line_item_id: "li_in", amount: 50, hold_days: 14 }])
  })

  it("matches only the direct categories of a product (Q2)", () => {
    const plan = planAttribution(
      input({
        programs: [program({ scope: { category_ids: ["pcat_parent"] } })],
        items: [{ id: "li_child", product_category_ids: ["pcat_child"], subtotal: 500 }],
      })
    )
    expect(plan).toEqual({ affiliate_id: "aff_ann", program_id: "affprog_p", entries: [] })
  })

  it("keeps the attribution but creates no entry for a self purchase, ignoring case and spaces (AC-8)", () => {
    const plan = planAttribution(
      input({
        affiliate: { id: "aff_ann", email: "  Ann@Example.com ", status: "active" },
        order: { email: "ann@example.COM", placed_at: placedAt },
      })
    )
    expect(plan).toEqual({ affiliate_id: "aff_ann", program_id: "affprog_p", entries: [] })
  })

  it("treats an ended program as inactive inside its window (AC-17)", () => {
    expect(planAttribution(input({ programs: [program({ status: "ended" })] }))).toEqual({
      affiliate_id: "aff_ann",
      program_id: null,
      entries: [],
    })
  })

  it("does not pay an order placed exactly at ends_at (AC-17, [starts_at, ends_at))", () => {
    expect(planAttribution(input({ programs: [program({ ends_at: placedAt })] }))?.entries).toEqual([])
  })

  it("ignores draft programs", () => {
    expect(planAttribution(input({ programs: [program({ status: "draft" })] }))?.program_id).toBeNull()
  })

  it("applies the window of each program: only programs whose window covers the click count", () => {
    const clicked_at = new Date(placedAt.getTime() - 10 * DAY)
    const plan = planAttribution(
      input({
        click: { affiliate_id: "aff_ann", clicked_at },
        programs: [
          program({ id: "affprog_short", commission_value: 20 }),
          program({ id: "affprog_long", commission_value: 5, attribution_window_days: 14 }),
        ],
      })
    )
    expect(plan).toEqual({
      affiliate_id: "aff_ann",
      program_id: "affprog_long",
      entries: [{ program_id: "affprog_long", line_item_id: "li_1", amount: 50, hold_days: 14 }],
    })
  })

  it("picks the highest rate per line and the latest starts_at on a tie (Q7)", () => {
    const plan = planAttribution(
      input({
        programs: [
          program({ id: "affprog_low", commission_value: 5, hold_days: 7 }),
          program({ id: "affprog_high", commission_value: 15, scope: { collection_ids: ["pcol_c"] } }),
          program({ id: "affprog_old", commission_value: 5, starts_at: new Date(placedAt.getTime() - 2 * DAY) }),
        ],
        items: [
          { id: "li_c", product_collection_id: "pcol_c", subtotal: 100 },
          { id: "li_other", subtotal: 1000 },
        ],
      })
    )
    expect(plan?.entries).toEqual([
      { program_id: "affprog_high", line_item_id: "li_c", amount: 15, hold_days: 14 },
      { program_id: "affprog_low", line_item_id: "li_other", amount: 50, hold_days: 7 },
    ])
    // attribution keeps the program with the largest total commission
    expect(plan?.program_id).toBe("affprog_low")
  })

  it("applies cap_per_order per program in line item order after rounding (Q3, rule 11)", () => {
    const plan = planAttribution(
      input({
        programs: [program({ cap_per_order: 120 })],
        items: [
          { id: "li_1", subtotal: 1000.05 },
          { id: "li_2", subtotal: 500 },
          { id: "li_3", subtotal: 300 },
        ],
      })
    )
    expect(plan?.entries.map((e) => [e.line_item_id, e.amount])).toEqual([
      ["li_1", 100.01],
      ["li_2", 19.99],
    ])
  })
})
