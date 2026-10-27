import { productFiltersForScope, selectProductProgram, shareUrl, variantsInScope } from "../portal"

// AF-7 (spec 05 กฎ 16, Q2): ขอบเขตโปรแกรม → สินค้าบน portal ใช้กฎเดียวกับการคำนวณของ AF-3
describe("productFiltersForScope", () => {
  it("covers every published product when scope.all is true", () => {
    expect(productFiltersForScope({ all: true, collection_ids: ["pcol_1"] })).toEqual({ status: "published" })
  })

  it("is the union of variant_ids, collection_ids and category_ids (direct categories only)", () => {
    expect(
      productFiltersForScope({ variant_ids: ["v1"], collection_ids: ["c1"], category_ids: ["cat1"] })
    ).toEqual({
      status: "published",
      $or: [{ variants: { id: ["v1"] } }, { collection_id: ["c1"] }, { categories: { id: ["cat1"] } }],
    })
  })

  it("skips empty lists", () => {
    expect(productFiltersForScope({ collection_ids: ["c1"], variant_ids: [] })).toEqual({
      status: "published",
      $or: [{ collection_id: ["c1"] }],
    })
  })

  it("returns null for a scope that covers nothing", () => {
    expect(productFiltersForScope({})).toBeNull()
    expect(productFiltersForScope({ all: false, variant_ids: [], category_ids: [] })).toBeNull()
  })
})

describe("variantsInScope", () => {
  const product = {
    collection_id: "c1",
    categories: [{ id: "cat1" }],
    variants: [{ id: "v1" }, { id: "v2" }],
  }

  it("keeps every variant when the product is covered by all, collection or category", () => {
    expect(variantsInScope({ all: true }, product)).toHaveLength(2)
    expect(variantsInScope({ collection_ids: ["c1"] }, product)).toHaveLength(2)
    expect(variantsInScope({ category_ids: ["cat1"] }, product)).toHaveLength(2)
  })

  it("keeps only the listed variants for a variant-scoped program", () => {
    expect(variantsInScope({ variant_ids: ["v2"] }, product)).toEqual([{ id: "v2" }])
  })

  it("does not count a parent category for a product in a child category (Q2)", () => {
    expect(variantsInScope({ category_ids: ["parent"] }, product)).toEqual([])
  })
})

describe("shareUrl", () => {
  it("builds {storefront}/r/{code}?to=/products/{handle}", () => {
    expect(shareUrl("https://shop.example/", "ann", "tee")).toEqual("https://shop.example/r/ann?to=/products/tee")
  })

  it("is a relative link when STOREFRONT_URL is not set", () => {
    expect(shareUrl(undefined, "ann", "tee")).toEqual("/r/ann?to=/products/tee")
  })
})

// AF-7b (spec 05 กฎ 29, AC-34): การ์ดเดียวต่อสินค้าต่อแท็บ ด้วยอัตราที่ได้จริง
describe("selectProductProgram", () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const program = (id: string, commission_value: number, startsInDays: number) => ({
    id,
    commission_value,
    starts_at: new Date(now + startsInDays * DAY),
  })
  const P1 = program("P1", 10, -1)
  const P2 = program("P2", 15, -3)
  const P3 = program("P3", 15, 0)

  it("active: highest rate wins, ties go to the latest starts_at", () => {
    const all = ["X1", "X2"]
    expect(
      selectProductProgram("active", [
        { program: P1, variant_ids: all },
        { program: P2, variant_ids: all },
        { program: P3, variant_ids: all },
      ])
    ).toEqual({ program: P3, variant_ids: ["X1", "X2"], rate_varies: false })
  })

  it("active: variants earning different rates → highest rate with rate_varies", () => {
    expect(
      selectProductProgram("active", [
        { program: P1, variant_ids: ["X1"] },
        { program: P2, variant_ids: ["X2"] },
      ])
    ).toEqual({ program: P2, variant_ids: ["X2", "X1"], rate_varies: true })
  })

  it("active: a variant covered by a lower rate too still earns the best rate", () => {
    expect(
      selectProductProgram("active", [
        { program: P1, variant_ids: ["X1", "X2"] },
        { program: P2, variant_ids: ["X1", "X2"] },
      ])
    ).toEqual(expect.objectContaining({ program: P2, rate_varies: false }))
  })

  it("upcoming: earliest starts_at wins, ties go to the highest rate", () => {
    const U1 = program("U1", 5, 1)
    const U2 = program("U2", 20, 2)
    const U3 = program("U3", 8, 1)
    expect(
      selectProductProgram("upcoming", [
        { program: U2, variant_ids: ["X1", "X2"] },
        { program: U1, variant_ids: ["X1"] },
        { program: U3, variant_ids: ["X2"] },
      ])
    ).toEqual({ program: U3, variant_ids: ["X2"], rate_varies: false })
  })

  it("compares rates as numbers, not strings", () => {
    expect(
      selectProductProgram("active", [
        { program: program("A", 9.5, -1), variant_ids: ["X1"] },
        { program: program("B", 10, -1), variant_ids: ["X1"] },
      ])?.program.id
    ).toEqual("B")
  })

  it("returns null when no program covers a variant", () => {
    expect(selectProductProgram("active", [])).toBeNull()
    expect(selectProductProgram("active", [{ program: P1, variant_ids: [] }])).toBeNull()
  })
})
