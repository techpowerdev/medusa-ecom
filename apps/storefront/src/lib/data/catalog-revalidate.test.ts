import { beforeEach, describe, expect, it, vi } from "vitest"

import { getCollectionByHandle, listCollections } from "./collections"
import { listProducts, listVariantIdsByProduct } from "./products"

// FS-17 (spec 03 กฎข้อ 22, AC-24; ADR-017 ทางเลือก A): fetch ข้อมูลแคตตาล็อกตั้ง `next.revalidate` ≤ 60 วินาทีเสมอ
// — ตอน render หน้า static/ISR ไม่มี cookie `_medusa_cache_id` จึงไม่มี tag; ถ้าไม่มี revalidate Next จะ cache ผล fetch ไม่มีกำหนด
// มี cookie → คง tag `<ชื่อ>-<cacheId>` (การ revalidate ตาม tag ของ starter ยังทำงาน)
// ใช้ getCacheOptions ตัวจริง (mock แค่ cookie ของ next/headers)

const fetch = vi.fn()
let cacheId: string | undefined

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "_medusa_cache_id" && cacheId ? { value: cacheId } : undefined,
  }),
}))
vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: (...a: unknown[]) => fetch(...a) } },
}))
vi.mock("@lib/data/regions", () => ({
  getRegion: vi.fn().mockResolvedValue({ id: "reg_1" }),
  retrieveRegion: vi.fn().mockResolvedValue({ id: "reg_1" }),
}))

type NextOpts = { revalidate?: unknown; tags?: string[] }

const cases: [string, string, () => Promise<unknown>][] = [
  ["listCollections", "collections", () => listCollections()],
  [
    "getCollectionByHandle",
    "collections",
    () => getCollectionByHandle("featured"),
  ],
  ["listProducts", "products", () => listProducts({ countryCode: "th" })],
  [
    "listVariantIdsByProduct",
    "products",
    () => listVariantIdsByProduct(["prod_1"]),
  ],
]

const nextOf = (): NextOpts => {
  expect(fetch).toHaveBeenCalledTimes(1)
  return fetch.mock.calls[0][1].next
}

beforeEach(() => {
  fetch.mockReset()
  fetch.mockResolvedValue({ collections: [], products: [], count: 0 })
  cacheId = undefined
})

describe("catalog fetch revalidate (FS-17, AC-24)", () => {
  it.each(cases)(
    "%s ไม่มี cookie → next.revalidate เป็นตัวเลข ≤ 60",
    async (_name, _tag, call) => {
      await call()
      const next = nextOf()
      expect(typeof next.revalidate).toBe("number")
      expect(next.revalidate as number).toBeGreaterThan(0)
      expect(next.revalidate as number).toBeLessThanOrEqual(60)
    }
  )

  it.each(cases)(
    "%s มี cookie → มีทั้ง revalidate และ tag <ชื่อ>-<cacheId>",
    async (_name, tag, call) => {
      cacheId = "abc"
      await call()
      const next = nextOf()
      expect(next.revalidate as number).toBeLessThanOrEqual(60)
      expect(next.tags).toEqual([`${tag}-abc`])
    }
  )

  it("data function ของ /store กับชุด hit ว่าง → ไม่เรียก fetch", async () => {
    expect(await listVariantIdsByProduct([])).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })
})
