import { productFiltersForScope, shareUrl, variantsInScope } from "../portal"

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
