import { beforeEach, describe, expect, it, vi } from "vitest"

import { listVariantIdsByProduct } from "./products"

// FS-14 (spec 03 กฎข้อ 19, AC-20): hit ของ search index ไม่มี variant id → หา variant id ของการ์ดที่แสดงอยู่ด้วย
// `GET /store/products` ของ Medusa หนึ่ง request ต่อชุด hit ของหน้า (ไม่เพิ่ม field ใน search index)

const fetch = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: (...a: unknown[]) => fetch(...a) } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCacheOptions: vi.fn().mockResolvedValue({ tags: ["products-t"] }),
}))
vi.mock("@lib/data/regions", () => ({
  getRegion: vi.fn(),
  retrieveRegion: vi.fn(),
}))

const ids = (n: number) => Array.from({ length: n }, (_, i) => `prod_${i}`)

beforeEach(() => {
  fetch.mockReset()
})

describe("listVariantIdsByProduct (FS-14)", () => {
  it("24 hit → เรียก GET /store/products 1 ครั้ง ด้วย id[] ทั้งหมดและ fields=id,variants.id", async () => {
    fetch.mockResolvedValue({
      products: ids(24).map((id) => ({
        id,
        variants: [{ id: `${id}_v1` }, { id: `${id}_v2` }],
      })),
    })

    const map = await listVariantIdsByProduct(ids(24))

    expect(fetch).toHaveBeenCalledTimes(1)
    const [path, init] = fetch.mock.calls[0]
    expect(path).toBe("/store/products")
    expect(init.method).toBe("GET")
    expect(init.query).toMatchObject({
      id: ids(24),
      fields: "id,variants.id",
      limit: 24,
    })
    expect(Object.keys(map)).toHaveLength(24)
    expect(map.prod_3).toEqual(["prod_3_v1", "prod_3_v2"])
  })

  it("id ซ้ำถูกรวม และ limit เท่าจำนวน id (ไม่ถูกตัดที่ค่า default 20 ของ Medusa)", async () => {
    fetch.mockResolvedValue({
      products: [{ id: "prod_1", variants: [{ id: "v1" }] }],
    })

    await listVariantIdsByProduct(["prod_1", "prod_1"])

    expect(fetch.mock.calls[0][1].query).toMatchObject({
      id: ["prod_1"],
      limit: 1,
    })
  })

  it("ไม่มี hit → ไม่ยิง request", async () => {
    expect(await listVariantIdsByProduct([])).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })

  it("request ล้ม → คืน {} (การ์ดแสดงราคาปกติ ไม่ทำให้หน้าพัง)", async () => {
    fetch.mockRejectedValue(new Error("boom"))
    expect(await listVariantIdsByProduct(["prod_1"])).toEqual({})
  })
})
