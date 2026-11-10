import { FetchError } from "@medusajs/js-sdk"
import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

// qa CORE-4c2 D-1: route no-JS `cart/add` เคยส่ง error ดิบของ Medusa ("Variants variant_bogus do not exist…") ให้ผู้ใช้
const createLineItem = vi.fn()

vi.mock("@lib/config", () => ({
  sdk: {
    store: {
      cart: {
        create: vi.fn().mockResolvedValue({ cart: { id: "cart_1" } }),
        createLineItem: (...args: unknown[]) => createLineItem(...args),
      },
    },
  },
}))
const syncCartAffiliateToken = vi.fn()
vi.mock("@lib/data/affiliate", () => ({
  syncCartAffiliateToken: (...args: unknown[]) => syncCartAffiliateToken(...args),
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCartId: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn().mockResolvedValue({ id: "reg_1" }) }))
vi.mock("@lib/util/server-cart", () => ({ activateCart: vi.fn() }))
vi.mock("@lib/util/site", () => ({ getRequestOrigin: () => "http://localhost:8000" }))

const post = async () => {
  const { POST } = await import("./app/[countryCode]/(main)/cart/add/route")
  const form = new FormData()
  form.set("variant_id", "variant_bogus")
  const request = new NextRequest("http://localhost:8000/th/cart/add", { method: "POST", body: form })
  return POST(request, { params: Promise.resolve({ countryCode: "th" }) })
}

describe("POST /[countryCode]/cart/add เมื่อเพิ่มสินค้าไม่สำเร็จ (qa D-1)", () => {
  it.each([
    ["variant ไม่มีอยู่ (400)", new FetchError("Variants variant_bogus do not exist", "Bad Request", 400)],
    ["error อื่น", new Error("boom")],
  ])("%s → 400 ข้อความไทย ไม่ส่งข้อความดิบของ backend", async (_name, error) => {
    createLineItem.mockRejectedValueOnce(error)
    const res = await post()
    const text = await res.text()
    expect(res.status).toBe(400)
    expect(text).toMatch(/[฀-๿]/)
    expect(text).not.toMatch(/[A-Za-z]{2,}/)
  })
})

// AF-3b (กฎ 23): sync cookie `aff` ด้วย metadata จากผลของ createLineItem — ไม่อ่าน cart (`GET /store/carts/:id`) เพิ่ม
describe("POST /[countryCode]/cart/add เมื่อเพิ่มสำเร็จ (AF-3b)", () => {
  it("ส่ง metadata ของ cart จากผลการเพิ่มสินค้าให้ sync cookie aff", async () => {
    createLineItem.mockResolvedValueOnce({ cart: { id: "cart_1", metadata: { affiliate_token: "tok_ann" } } })
    const res = await post()
    expect(res.status).toBe(303)
    expect(syncCartAffiliateToken).toHaveBeenCalledWith(
      "cart_1",
      { affiliate_token: "tok_ann" },
      { authorization: "Bearer t" }
    )
  })
})
