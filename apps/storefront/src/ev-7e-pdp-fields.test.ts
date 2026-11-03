import { beforeEach, describe, expect, it, vi } from "vitest"

// EV-7e (spec 02 กฎข้อ 29c, AC-43): `generateMetadata` กับหน้า PDP เรียก listProducts ด้วยชุด `fields` เดียวกัน
// (URL ของ fetch เท่ากัน → Next dedupe ได้ → 1 request ต่อ render) และมี field ของ pool/partner (กฎข้อ 23)
const listProducts = vi.fn()

vi.mock("@lib/data/products", () => ({ listProducts: (...a: unknown[]) => listProducts(...a) }))
vi.mock("@lib/data/regions", () => ({
  getRegion: async () => ({ id: "reg_th", currency_code: "thb" }),
  listRegions: async () => [],
  retrieveRegionUncached: async () => null,
}))
vi.mock("@lib/util/site", () => ({
  getSiteOrigin: async () => "https://shop.test",
  listCountryCodes: () => ["th"],
  STORE_NAME: "ร้าน",
}))
vi.mock("@modules/products/templates", () => ({ default: () => null }))
vi.mock("@lib/util/product-structured-data", () => ({
  buildProductStructuredData: () => ({}),
  getPricedVariants: () => [],
  toJsonLd: () => "{}",
}))

const PRODUCT = { id: "prod_1", handle: "voucher", title: "Voucher", variants: [] }
const props = {
  params: Promise.resolve({ countryCode: "th", handle: "voucher" }),
}

describe("PDP fields (กฎข้อ 29c)", () => {
  beforeEach(() => {
    listProducts.mockReset().mockResolvedValue({ response: { products: [PRODUCT], count: 1 } })
  })

  it("generateMetadata กับหน้าเรียก listProducts ด้วย argument เดียวกัน (รวม field ของ pool/partner)", async () => {
    const { default: ProductPage, generateMetadata } = await import(
      "./app/[countryCode]/(main)/products/[handle]/page"
    )
    const { EVOUCHER_POOL_FIELDS } = await import("@lib/util/evoucher")

    await generateMetadata(props)
    await ProductPage(props)

    expect(listProducts).toHaveBeenCalledTimes(2)
    const [metadataArgs, pageArgs] = listProducts.mock.calls.map(([args]) => args)
    expect(metadataArgs).toEqual(pageArgs)
    expect(pageArgs.extraFields).toBe(EVOUCHER_POOL_FIELDS)
  })
})
