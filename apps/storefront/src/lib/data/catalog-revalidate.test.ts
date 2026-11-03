import { beforeEach, describe, expect, it, vi } from "vitest"

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { getCategoryByHandle, listCategories } from "./categories"
import {
  getCollectionByHandle,
  listCollections,
  retrieveCollection,
} from "./collections"
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
// products.ts ใช้ getRegion/retrieveRegion แบบ mock (ไม่ยิง fetch ของ region ซ้อน); test ของ region เรียกตัวจริงผ่าน importActual
vi.mock("@lib/data/regions", () => ({
  getRegion: vi.fn().mockResolvedValue({ id: "reg_1" }),
  retrieveRegion: vi.fn().mockResolvedValue({ id: "reg_1" }),
}))
const realRegions = () =>
  vi.importActual<typeof import("./regions")>("./regions")

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
  // FS-18 (กฎข้อ 23a, AC-25)
  ["listCategories", "categories", () => listCategories()],
  ["getCategoryByHandle", "categories", () => getCategoryByHandle(["shirts"])],
  ["listRegions", "regions", async () => (await realRegions()).listRegions()],
  [
    "retrieveRegion",
    "regions-reg_1",
    async () => (await realRegions()).retrieveRegion("reg_1"),
  ],
  ["retrieveCollection", "collections", () => retrieveCollection("pcol_1")],
]

const nextOf = (): NextOpts => {
  expect(fetch).toHaveBeenCalledTimes(1)
  return fetch.mock.calls[0][1].next
}

beforeEach(() => {
  fetch.mockReset()
  fetch.mockResolvedValue({
    collections: [],
    products: [],
    count: 0,
    product_categories: [],
    regions: [],
  })
  cacheId = undefined
})

describe("catalog fetch revalidate (FS-17 AC-24, FS-18 AC-25)", () => {
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

// FS-18 (กฎข้อ 23a, AC-25) static: ทุก fetch ใน lib/data ที่ตั้ง `force-cache` ต้องมี `revalidate` ในฟังก์ชันเดียวกัน
// ยกเว้นข้อมูลต่อ cart/customer ที่ storefront revalidate ตาม tag เองหลัง mutation ของลูกค้า (ข้อมูลนี้ไม่ render ตอน static/ISR
// และเปิดได้เฉพาะเมื่อมี cookie ของ cart/ลูกค้า) — เหตุผลระบุต่อรายการ
const FORCE_CACHE_WITHOUT_REVALIDATE: Record<string, string> = {
  "cart.ts:retrieveCart":
    "cart ของลูกค้า — revalidateTag('carts') หลังทุก mutation และมี fresh: no-store สำหรับ checkout",
  "cart.ts:listCartOptions":
    "shipping option ต่อ cart_id — revalidateTag ของ cart/fulfillment หลัง mutation ของ cart",
  "fulfillment.ts:listCartShippingMethods":
    "shipping option ต่อ cart_id — revalidateTag('fulfillment') หลัง mutation ของ cart",
  "customer.ts:retrieveCustomer":
    "ข้อมูลของลูกค้าที่ login — revalidateTag('customers') หลัง mutation ของลูกค้า",
}

const DATA_DIR = path.resolve(__dirname)

function forceCacheWithoutRevalidate(): string[] {
  const found: string[] = []
  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue
    const src = readFileSync(path.join(DATA_DIR, file), "utf8")
    // แบ่งตามการประกาศ export ระดับบนสุด (ทุก data function ใน lib/data เป็น export)
    const chunks = src.split(/^export (?=(?:const|async function|function) )/m)
    for (const chunk of chunks.slice(1)) {
      if (!chunk.includes('"force-cache"') || chunk.includes("revalidate:")) {
        continue
      }
      const name = chunk.match(/^(?:const|async function|function) (\w+)/)![1]
      found.push(`${file}:${name}`)
    }
  }
  return found.sort()
}

describe("lib/data ไม่มี force-cache ที่ไม่มี revalidate (FS-18, AC-25)", () => {
  it("ทุกรายการที่เหลือมีเหตุผลใน FORCE_CACHE_WITHOUT_REVALIDATE", () => {
    expect(forceCacheWithoutRevalidate()).toEqual(
      Object.keys(FORCE_CACHE_WITHOUT_REVALIDATE).sort()
    )
  })
})
