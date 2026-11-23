import { describe, expect, it, vi } from "vitest"

import { sdk } from "@lib/config"

import {
  SEARCH_PRICE_CURRENCIES,
  indexedCurrency,
  priceAttribute,
  searchProductIds,
  storeStateMapping,
} from "./search-client"

// search-client สร้าง adapter จาก sdk ตอน import — mock (vi.mock ถูก hoist ขึ้นก่อน import)
// เพื่อทดสอบเฉพาะ logic สกุลเงิน
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: vi.fn() } } }))

// CORE-9 (spec 01 กฎข้อ 15, AC-26): index เก็บราคาเฉพาะ THB — region Thailand อ่าน field _thb
describe("search price currencies (CORE-9)", () => {
  it("SEARCH_PRICE_CURRENCIES เป็น ['thb']", () => {
    expect(SEARCH_PRICE_CURRENCIES).toEqual(["thb"])
  })

  it('indexedCurrency("THB") === "thb"', () => {
    expect(indexedCurrency("THB")).toBe("thb")
  })

  it("priceAttribute ของ region THB ชี้ field _thb", () => {
    expect(priceAttribute("min_price", "thb")).toBe("min_price_thb")
  })
})

// CORE-70 (spec 01 กฎข้อ 128b, AC-169): URL ของ /store ใช้ `q` แทน `product[query]` ของ InstantSearch
describe("storeStateMapping (CORE-70)", () => {
  it("routeToState: ?q=<คำ> → คำค้นของ index product", () => {
    expect(storeStateMapping.routeToState({ q: "shirt" })).toEqual({
      product: { query: "shirt" },
    })
  })

  it("routeToState: q ร่วมกับตัวกรองอื่นของ index เดิม", () => {
    expect(
      storeStateMapping.routeToState({
        q: "shirt",
        product: { refinementList: { category: ["เสื้อ"] }, page: 2 },
      })
    ).toEqual({
      product: {
        query: "shirt",
        refinementList: { category: ["เสื้อ"] },
        page: 2,
      },
    })
  })

  it("routeToState: URL เดิม product[query] ยังใช้ได้ และไม่มี q → ไม่ตั้งคำค้น", () => {
    expect(
      storeStateMapping.routeToState({ product: { query: "old" } })
    ).toEqual({ product: { query: "old" } })
    expect(storeStateMapping.routeToState({})).toEqual({})
  })

  it("stateToRoute: คำค้นออกเป็น q ส่วนตัวกรองคงอยู่ใต้ product (ไม่มี configure)", () => {
    expect(
      storeStateMapping.stateToRoute({
        product: {
          query: "shirt",
          page: 2,
          configure: { hitsPerPage: 12 },
        },
      })
    ).toEqual({ q: "shirt", product: { page: 2 } })
  })

  it("stateToRoute: ไม่มีคำค้น → ไม่มี q", () => {
    expect(
      storeStateMapping.stateToRoute({ product: { query: "", page: 2 } })
    ).toEqual({ product: { page: 2 } })
  })
})

// CORE-70 (spec 01 กฎข้อ 128a, AC-169): หน้า /search ใช้ POST /store/search ผ่าน adapter เดียวกับ drawer และ /store
describe("searchProductIds (CORE-70)", () => {
  it("ส่ง POST /store/search ด้วย q + match_strategy เดียวกับ drawer แล้วคืน id ตามลำดับผล + จำนวนทั้งหมด", async () => {
    const fetch = vi.mocked(sdk.client.fetch)
    fetch.mockResolvedValueOnce({
      results: [
        {
          hits: [
            { id: "prod_b", document: { id: "prod_b" } },
            { id: "prod_a", document: { id: "prod_a" } },
          ],
          metadata: { skip: 0, take: 24, count: 30 },
        },
      ],
    })

    await expect(searchProductIds("shirt", 24)).resolves.toEqual({
      ids: ["prod_b", "prod_a"],
      count: 30,
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [path, init] = fetch.mock.calls[0] as [
      string,
      { method: string; body: { queries: Record<string, unknown>[] } },
    ]
    expect(path).toBe("/store/search")
    expect(init.method).toBe("POST")
    expect(init.body.queries[0]).toMatchObject({
      entity: "product",
      filters: { q: "shirt" },
      pagination: { take: 24, skip: 0 },
      search_options: { match_strategy: "last" },
    })
  })

  const searchOptionsFor = async (q: string) => {
    const fetch = vi.mocked(sdk.client.fetch)
    fetch.mockClear()
    fetch.mockResolvedValueOnce({
      results: [{ hits: [], metadata: { skip: 0, take: 24, count: 0 } }],
    })

    await searchProductIds(q, 24)

    const [, init] = fetch.mock.calls[0] as [
      string,
      { body: { queries: { search_options?: Record<string, unknown> }[] } },
    ]
    return init.body.queries[0].search_options
  }

  // CORE-75 (spec 01 กฎข้อ 133, AC-174) + CORE-88 (กฎข้อ 144, AC-185): typo_tolerance ของ Medusa (pg_trgm word_similarity)
  // ส่งเฉพาะคำค้นที่ trim แล้ว ≥ 3 code point — คำไทยกลางคำเจอ แต่คำ 2 อักขระไม่คืนทั้ง catalog
  it.each(["ยืด", "สเวตเตอร์", "ยีนส์", "ขายาว", "เสื้อ", "กางเกง", "shirt"])(
    "คำค้น %j (≥ 3 code point) → ส่ง typo_tolerance: true",
    async (q) => {
      expect(await searchOptionsFor(q)).toEqual({
        match_strategy: "last",
        typo_tolerance: true,
      })
    }
  )

  it.each(["ขา", "  ขา  ", "ab"])(
    "คำค้น %j (trim แล้ว < 3 code point) → ไม่ส่ง typo_tolerance",
    async (q) => {
      expect(await searchOptionsFor(q)).toEqual({ match_strategy: "last" })
    }
  )
})
